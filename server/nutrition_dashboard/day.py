"""Day boundaries and the aggregation of one day into the API response.

Both functions are pure: no database, no clock, no configuration - everything arrives as an
argument. The database layer (``db.py``) collects the rows, this module turns them into the
JSON shape the browser consumes.
"""

from datetime import UTC, date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from .models import GoalsRow, MealRow, RawDay, WaterRow

NUTRIENTS = ("kcal", "protein_g", "carbs_g", "fat_g")


def day_bounds(day: date, tz: str) -> tuple[datetime, datetime]:
    """Return the half-open interval ``[start, end)`` that covers ``day`` in the zone ``tz``.

    ``start`` is midnight at the beginning of ``day`` in ``tz``, ``end`` is midnight at the
    beginning of the following day, both converted to UTC (``datetime`` with ``tzinfo``,
    comparison and ``isoformat()`` must work).

    Requirements:
    - Use ``zoneinfo.ZoneInfo``, never a fixed UTC offset: the days around a DST switch are
      23 or 25 hours long, and the returned interval must be exactly that long.
    - ``tz`` is an IANA name (``"Europe/Vienna"``); an unknown name propagates
      ``zoneinfo.ZoneInfoNotFoundError`` unchanged.

    Examples (Europe/Vienna, 2026: DST starts 29 March, ends 25 October):
    - ``day_bounds(date(2026, 10, 30), "Europe/Vienna")`` -> ``2026-10-29 23:00Z`` to
      ``2026-10-30 23:00Z`` (CET, 24 h)
    - ``day_bounds(date(2026, 10, 25), "Europe/Vienna")`` -> ``2026-10-24 22:00Z`` to
      ``2026-10-25 23:00Z`` (25 h, the DST switch)
    - ``day_bounds(date(2026, 3, 29), "Europe/Vienna")`` -> ``2026-03-28 23:00Z`` to
      ``2026-03-29 22:00Z`` (23 h)
    """
    zone = ZoneInfo(tz)
    next_day = day + timedelta(days=1)
    start = datetime(day.year, day.month, day.day, tzinfo=zone)
    end = datetime(next_day.year, next_day.month, next_day.day, tzinfo=zone)
    return start.astimezone(UTC), end.astimezone(UTC)


def _minute_key(moment: datetime, zone: ZoneInfo) -> str:
    """Local wall-clock minute of ``moment`` (``"HH:MM"``)."""
    return moment.astimezone(zone).strftime("%H:%M")


def _foods(meal_row: MealRow) -> list[str]:
    """The comma-separated components of a meal, or its name when there are none."""
    components = meal_row.components or ""
    if not components.strip():
        return [meal_row.name]
    parts: list[str] = []
    current: list[str] = []
    depth = 0
    for char in components:
        if char == "(":
            depth += 1
        elif char == ")" and depth > 0:
            depth -= 1
        if char == "," and depth == 0:
            parts.append("".join(current))
            current = []
            continue
        current.append(char)
    parts.append("".join(current))
    return [stripped for part in parts if (stripped := part.strip())]


def _entry(minute: str, meals: list[MealRow], water_rows: list[WaterRow]) -> dict[str, Any]:
    """One entry of the response for the given local minute."""
    meals = sorted(meals, key=lambda row: row.eaten_at)
    foods = [food for meal_row in meals for food in _foods(meal_row)]
    foods += [f"{water_row.ml} ml" for water_row in water_rows]
    return {
        "time": minute,
        "kind": "meal" if meals else "water",
        "meal_types": list(dict.fromkeys(row.meal_type for row in meals)),
        "foods": foods,
        **{key: round(float(sum(getattr(row, key) for row in meals)), 1) for key in NUTRIENTS},
        "water_ml": sum(water_row.ml for water_row in water_rows),
    }


def _goals(goals: GoalsRow | None) -> dict[str, Any]:
    """The goals block; a missing row or a column the user never set is ``None``."""
    if goals is None:
        return dict.fromkeys((*NUTRIENTS, "water_ml"))
    converted: dict[str, Any] = {
        key: None if (value := getattr(goals, key)) is None else round(float(value), 1)
        for key in NUTRIENTS
    }
    converted["water_ml"] = goals.water_ml
    return converted


def build_day(day: date, raw: RawDay, tz: str) -> dict[str, Any]:
    """Turn the rows of one day into the response of ``GET /api/today``.

    Return exactly this structure (all keys always present)::

        {
          "date": "2026-10-30",              # day.isoformat()
          "timezone": "Europe/Vienna",       # tz, unchanged
          "goals": {"kcal": 2000.0, "protein_g": 130.0, "carbs_g": 210.0,
                    "fat_g": 70.0, "water_ml": 3000},
          "totals": {"kcal": 1624.4, "protein_g": 134.8, "carbs_g": 107.1,
                     "fat_g": 71.2, "water_ml": 2000},
          "entries": [
            {"time": "07:30", "kind": "meal", "meal_types": ["breakfast"],
             "foods": ["Kaffee mit Milch 1 Tasse", "Overnight Oats Bowl 1 Portion"],
             "kcal": 554.0, "protein_g": 49.3, "carbs_g": 58.2, "fat_g": 12.9,
             "water_ml": 0},
            {"time": "10:44", "kind": "water", "meal_types": [], "foods": ["2000 ml"],
             "kcal": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0,
             "water_ml": 2000}
          ]
        }

    Rules, in this order:
    - ``entries`` holds one element per distinct local wall-clock minute of the day. Build the
      minute key from the local time (``.astimezone(ZoneInfo(tz)).strftime("%H:%M")``), not from
      the raw UTC timestamp - rows that belong to the same local minute share one entry.
    - ``entries`` is sorted ascending by that local time of day.
    - ``kind`` is ``"meal"`` as soon as the minute contains at least one meal row, otherwise
      ``"water"``.
    - ``meal_types`` lists the distinct ``meal_type`` values of the minute's meal rows, in the
      order the rows appear once they are sorted by ``eaten_at`` (ties keep the given order).
    - ``foods`` collects, per meal row in that same order: if ``components`` is a string with
      something besides whitespace, split it at commas into parts, stripped, empty parts dropped
      (``"Kaffee mit Milch 1 Tasse, Overnight Oats Bowl 1 Portion"`` -> two entries); otherwise
      the row's ``name``. **A comma inside parentheses separates nothing:**
      ``"High Protein Milchreis 1 Portion (½ Dose, 200 g)"`` stays ONE food, because the
      parenthesis carries the portion note and real rows are written that way. Walk the string,
      track the parenthesis depth and split at depth 0 only (``'('`` increases, ``')'`` decreases,
      never below 0). After all meal rows follow one ``"<ml> ml"`` string per water row of the
      minute (``"2000 ml"``).
    - The nutrient keys of an entry are the sums over its meal rows, converted to ``float`` and
      rounded to one decimal (``round(float(value), 1)``); ``water_ml`` is the ``int`` sum over
      its water rows. A key without a matching row is ``0`` / ``0.0``, never ``None``.
    - ``totals`` sums over all entries the same way (``water_ml`` as ``int``).
    - ``goals`` maps the ``GoalsRow`` fields through ``float`` rounded to one decimal
      (``water_ml`` stays ``int``); a column that is ``None`` stays ``None``, and
      ``raw.goals is None`` means every goal is ``None``.
    - An empty day (no meals, no water) returns an empty ``entries`` list, totals of ``0`` and
      the goals as they are - not an error.
    """
    zone = ZoneInfo(tz)
    meals_by_minute: dict[str, list[MealRow]] = {}
    water_by_minute: dict[str, list[WaterRow]] = {}
    for meal_row in raw.meals:
        meals_by_minute.setdefault(_minute_key(meal_row.eaten_at, zone), []).append(meal_row)
    for water_row in raw.water:
        water_by_minute.setdefault(_minute_key(water_row.drunk_at, zone), []).append(water_row)

    entries = [
        _entry(minute, meals_by_minute.get(minute, []), water_by_minute.get(minute, []))
        for minute in sorted(meals_by_minute.keys() | water_by_minute.keys())
    ]
    return {
        "date": day.isoformat(),
        "timezone": tz,
        "goals": _goals(raw.goals),
        "totals": {
            **{key: round(sum(entry[key] for entry in entries), 1) for key in NUTRIENTS},
            "water_ml": sum(entry["water_ml"] for entry in entries),
        },
        "entries": entries,
    }
