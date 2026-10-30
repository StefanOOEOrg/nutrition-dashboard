"""Day boundaries and the aggregation of one day into the API response.

Both functions are pure: no database, no clock, no configuration - everything arrives as an
argument. The database layer (``db.py``) collects the rows, this module turns them into the
JSON shape the browser consumes.
"""

from datetime import date, datetime
from typing import Any

from .models import RawDay


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
    raise NotImplementedError


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
      something besides whitespace, every comma-separated part, stripped, empty parts dropped
      (``"Kaffee mit Milch 1 Tasse, Overnight Oats Bowl 1 Portion"`` -> two entries); otherwise
      the row's ``name``. After all meal rows follow one ``"<ml> ml"`` string per water row of
      the minute (``"2000 ml"``).
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
    raise NotImplementedError
