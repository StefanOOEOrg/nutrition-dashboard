"""Specs for the pure day aggregation: boundaries in the local zone and the response shape."""

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from nutrition_dashboard.day import build_day, day_bounds
from nutrition_dashboard.models import GoalsRow, MealRow, RawDay, WaterRow

TZ = "Europe/Vienna"

# 30 October 2026 is CET (UTC+1): local 12:00 is 11:00Z.


def meal(
    eaten_at: str,
    *,
    meal_type: str = "lunch",
    name: str = "Meal",
    components: str | None = None,
    kcal: str = "100",
    protein_g: str = "10",
    carbs_g: str = "10",
    fat_g: str = "5",
) -> MealRow:
    """MealRow from an ISO timestamp (``+00:00`` = UTC)."""
    return MealRow(
        eaten_at=datetime.fromisoformat(eaten_at),
        meal_type=meal_type,
        name=name,
        components=components,
        kcal=Decimal(kcal),
        protein_g=Decimal(protein_g),
        carbs_g=Decimal(carbs_g),
        fat_g=Decimal(fat_g),
    )


def water(drunk_at: str, ml: int) -> WaterRow:
    """WaterRow from an ISO timestamp."""
    return WaterRow(drunk_at=datetime.fromisoformat(drunk_at), ml=ml)


def raw(
    *,
    meals: tuple[MealRow, ...] = (),
    water_rows: tuple[WaterRow, ...] = (),
    goals: GoalsRow | None = None,
) -> RawDay:
    """RawDay with the given rows."""
    return RawDay(meals=meals, water=water_rows, goals=goals)


def all_goals() -> GoalsRow:
    """The goals of 30 October 2026 as the user set them."""
    return GoalsRow(
        kcal=Decimal("2000"),
        protein_g=Decimal("130"),
        carbs_g=Decimal("210"),
        fat_g=Decimal("70"),
        water_ml=3000,
    )


# --- day_bounds ---------------------------------------------------------------------------


def test_day_bounds_of_a_cet_day_is_24_hours() -> None:
    start, end = day_bounds(date(2026, 10, 30), TZ)
    assert start.astimezone(UTC).isoformat() == "2026-10-29T23:00:00+00:00"
    assert end.astimezone(UTC).isoformat() == "2026-10-30T23:00:00+00:00"
    assert end - start == timedelta(hours=24)


def test_day_bounds_of_the_day_dst_ends_is_25_hours() -> None:
    start, end = day_bounds(date(2026, 10, 25), TZ)
    assert start.astimezone(UTC).isoformat() == "2026-10-24T22:00:00+00:00"
    assert end.astimezone(UTC).isoformat() == "2026-10-25T23:00:00+00:00"
    assert end - start == timedelta(hours=25)


def test_day_bounds_of_the_day_dst_starts_is_23_hours() -> None:
    start, end = day_bounds(date(2026, 3, 29), TZ)
    assert start.astimezone(UTC).isoformat() == "2026-03-28T23:00:00+00:00"
    assert end.astimezone(UTC).isoformat() == "2026-03-29T22:00:00+00:00"
    assert end - start == timedelta(hours=23)


# --- build_day: entries -------------------------------------------------------------------


def test_rows_of_the_same_local_minute_become_one_entry() -> None:
    result = build_day(
        date(2026, 10, 30),
        raw(
            meals=(
                meal(
                    "2026-10-30T11:00:00+00:00",
                    name="2 Eier",
                    kcal="166.4",
                    protein_g="14",
                    carbs_g="0.8",
                    fat_g="11.8",
                ),
                meal(
                    "2026-10-30T11:00:20+00:00",
                    name="Faschiertes",
                    kcal="564",
                    protein_g="41.5",
                    carbs_g="6.1",
                    fat_g="40.5",
                ),
            )
        ),
        TZ,
    )
    assert len(result["entries"]) == 1
    entry = result["entries"][0]
    assert entry["time"] == "12:00"
    assert entry["kind"] == "meal"
    assert entry["meal_types"] == ["lunch"]
    assert entry["foods"] == ["2 Eier", "Faschiertes"]
    assert entry["kcal"] == 730.4
    assert entry["protein_g"] == 55.5
    assert entry["carbs_g"] == 6.9
    assert entry["fat_g"] == 52.3


def test_components_are_split_at_commas_and_blank_components_fall_back_to_the_name() -> None:
    result = build_day(
        date(2026, 10, 30),
        raw(
            meals=(
                meal(
                    "2026-10-30T06:30:00+00:00",
                    meal_type="breakfast",
                    name="Frühstück (Kaffee & Oats)",
                    components="Kaffee mit Milch 1 Tasse, Overnight Oats Bowl 1 Portion",
                ),
                meal(
                    "2026-10-30T06:30:30+00:00",
                    meal_type="breakfast",
                    name="Apfel",
                    components="   ",
                ),
            ),
            goals=all_goals(),
        ),
        TZ,
    )
    assert result["entries"][0]["foods"] == [
        "Kaffee mit Milch 1 Tasse",
        "Overnight Oats Bowl 1 Portion",
        "Apfel",
    ]


def test_meal_types_are_distinct_and_keep_the_order_of_the_rows() -> None:
    result = build_day(
        date(2026, 10, 30),
        raw(
            meals=(
                meal("2026-10-30T17:00:00+00:00", meal_type="drink", name="Holy Scoop"),
                meal("2026-10-30T17:00:05+00:00", meal_type="snack", name="Apfel"),
                meal("2026-10-30T17:00:09+00:00", meal_type="drink", name="Kaffee"),
            )
        ),
        TZ,
    )
    assert result["entries"][0]["meal_types"] == ["drink", "snack"]


def test_water_in_a_meal_minute_is_listed_after_the_foods() -> None:
    result = build_day(
        date(2026, 10, 30),
        raw(
            meals=(meal("2026-10-30T09:44:00+00:00", meal_type="snack", name="Apfel"),),
            water_rows=(water("2026-10-30T09:44:30+00:00", 500),),
        ),
        TZ,
    )
    entry = result["entries"][0]
    assert entry["time"] == "10:44"
    assert entry["kind"] == "meal"
    assert entry["foods"] == ["Apfel", "500 ml"]
    assert entry["water_ml"] == 500


def test_a_water_only_minute_is_kind_water_with_zero_calories() -> None:
    result = build_day(
        date(2026, 10, 30), raw(water_rows=(water("2026-10-30T04:00:00+00:00", 2000),)), TZ
    )
    entry = result["entries"][0]
    assert entry["time"] == "05:00"
    assert entry["kind"] == "water"
    assert entry["meal_types"] == []
    assert entry["foods"] == ["2000 ml"]
    assert entry["kcal"] == 0.0
    assert entry["protein_g"] == 0.0
    assert entry["carbs_g"] == 0.0
    assert entry["fat_g"] == 0.0
    assert entry["water_ml"] == 2000


def test_entries_are_sorted_by_local_time() -> None:
    result = build_day(
        date(2026, 10, 30),
        raw(
            meals=(
                meal("2026-10-30T10:00:00+00:00", name="Lunch"),
                meal("2026-10-30T06:30:00+00:00", name="Breakfast"),
            ),
            water_rows=(water("2026-10-30T09:44:16+00:00", 2000),),
        ),
        TZ,
    )
    assert [entry["time"] for entry in result["entries"]] == ["07:30", "10:44", "11:00"]


def test_nutrients_are_rounded_to_one_decimal() -> None:
    result = build_day(
        date(2026, 10, 30),
        raw(
            meals=(
                meal("2026-10-30T11:00:00+00:00", kcal="554.44", protein_g="0.05"),
                meal("2026-10-30T11:00:10+00:00", kcal="0.06", protein_g="0.05"),
            )
        ),
        TZ,
    )
    assert result["entries"][0]["kcal"] == 554.5
    assert result["entries"][0]["protein_g"] == 0.1


# --- build_day: totals, goals, empty day ---------------------------------------------------


def test_totals_sum_all_entries_and_goals_are_floats() -> None:
    result = build_day(
        date(2026, 10, 30),
        raw(
            meals=(
                meal(
                    "2026-10-30T06:30:00+00:00",
                    meal_type="breakfast",
                    kcal="554",
                    protein_g="49.3",
                    carbs_g="58.2",
                    fat_g="12.9",
                ),
                meal(
                    "2026-10-30T11:00:00+00:00",
                    kcal="730.4",
                    protein_g="55.5",
                    carbs_g="6.9",
                    fat_g="52.3",
                ),
            ),
            water_rows=(water("2026-10-30T09:44:00+00:00", 2000),),
            goals=all_goals(),
        ),
        TZ,
    )
    assert result["date"] == "2026-10-30"
    assert result["timezone"] == TZ
    assert result["totals"] == {
        "kcal": 1284.4,
        "protein_g": 104.8,
        "carbs_g": 65.1,
        "fat_g": 65.2,
        "water_ml": 2000,
    }
    assert result["goals"] == {
        "kcal": 2000.0,
        "protein_g": 130.0,
        "carbs_g": 210.0,
        "fat_g": 70.0,
        "water_ml": 3000,
    }


def test_a_goal_that_was_never_set_stays_none() -> None:
    result = build_day(
        date(2026, 10, 30),
        raw(
            meals=(meal("2026-10-30T11:00:00+00:00", kcal="500"),),
            goals=GoalsRow(
                kcal=Decimal("2000"),
                protein_g=None,
                carbs_g=Decimal("210"),
                fat_g=None,
                water_ml=None,
            ),
        ),
        TZ,
    )
    assert result["goals"] == {
        "kcal": 2000.0,
        "protein_g": None,
        "carbs_g": 210.0,
        "fat_g": None,
        "water_ml": None,
    }


def test_without_a_goals_row_every_goal_is_none() -> None:
    result = build_day(
        date(2026, 10, 30), raw(meals=(meal("2026-10-30T11:00:00+00:00", kcal="500"),)), TZ
    )
    assert result["goals"] == {
        "kcal": None,
        "protein_g": None,
        "carbs_g": None,
        "fat_g": None,
        "water_ml": None,
    }


def test_an_empty_day_returns_empty_entries_and_zero_totals() -> None:
    result = build_day(date(2026, 10, 30), raw(goals=all_goals()), TZ)
    assert result["entries"] == []
    assert result["totals"] == {
        "kcal": 0.0,
        "protein_g": 0.0,
        "carbs_g": 0.0,
        "fat_g": 0.0,
        "water_ml": 0,
    }
    assert result["goals"]["kcal"] == 2000.0
