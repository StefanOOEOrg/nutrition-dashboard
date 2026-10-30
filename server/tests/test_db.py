"""Specs for the database layer, against a throwaway schema in a real Postgres."""

from datetime import UTC, date, datetime
from decimal import Decimal

from nutrition_dashboard.db import load_day
from nutrition_dashboard.models import GoalsRow

from .conftest import Day

TZ = "Europe/Vienna"


def test_load_day_returns_the_rows_of_the_day(day: Day, schema: str) -> None:
    day.meal(
        datetime(2026, 10, 30, 6, 30, tzinfo=UTC),
        meal_type="breakfast",
        name="Frühstück (Kaffee & Oats)",
        components="Kaffee mit Milch 1 Tasse, Overnight Oats Bowl 1 Portion",
        kcal="554",
        protein_g="49.3",
        carbs_g="58.2",
        fat_g="12.9",
    )
    day.meal(datetime(2026, 10, 30, 11, 0, tzinfo=UTC), name="2 Eier", kcal="166.4")
    day.water(datetime(2026, 10, 30, 9, 44, 16, tzinfo=UTC), 2000)
    day.goals()

    raw = load_day(date(2026, 10, 30), url=day.url, tz=TZ, schema=schema)

    assert [row.name for row in raw.meals] == ["Frühstück (Kaffee & Oats)", "2 Eier"]
    assert raw.meals[0].meal_type == "breakfast"
    assert raw.meals[0].components == "Kaffee mit Milch 1 Tasse, Overnight Oats Bowl 1 Portion"
    assert raw.meals[0].kcal == Decimal("554")
    assert isinstance(raw.meals[0].kcal, Decimal)
    assert raw.meals[1].kcal == Decimal("166.4")
    assert len(raw.water) == 1
    assert raw.water[0].ml == 2000
    assert raw.water[0].drunk_at.astimezone(UTC) == datetime(2026, 10, 30, 9, 44, 16, tzinfo=UTC)
    assert raw.goals == GoalsRow(
        kcal=Decimal("2000"),
        protein_g=Decimal("130"),
        carbs_g=Decimal("210"),
        fat_g=Decimal("70"),
        water_ml=3000,
    )


def test_load_day_uses_the_local_day_not_the_utc_day(day: Day, schema: str) -> None:
    # 29 October 23:30Z is 30 October 00:30 in Vienna -> inside the day.
    day.meal(datetime(2026, 10, 29, 23, 30, tzinfo=UTC), name="Late night")
    # 30 October 23:30Z is 31 October 00:30 in Vienna -> outside the day.
    day.meal(datetime(2026, 10, 30, 23, 30, tzinfo=UTC), name="Next day")
    day.water(datetime(2026, 10, 30, 23, 0, tzinfo=UTC), 250)

    raw = load_day(date(2026, 10, 30), url=day.url, tz=TZ, schema=schema)

    assert [row.name for row in raw.meals] == ["Late night"]
    assert [row.ml for row in raw.water] == [250]


def test_load_day_orders_meals_by_time(day: Day, schema: str) -> None:
    day.meal(datetime(2026, 10, 30, 11, 0, tzinfo=UTC), name="Lunch")
    day.meal(datetime(2026, 10, 30, 6, 30, tzinfo=UTC), name="Breakfast")

    raw = load_day(date(2026, 10, 30), url=day.url, tz=TZ, schema=schema)

    assert [row.name for row in raw.meals] == ["Breakfast", "Lunch"]


def test_load_day_without_a_goals_row_returns_none(day: Day, schema: str) -> None:
    raw = load_day(date(2026, 10, 30), url=day.url, tz=TZ, schema=schema)
    assert raw.goals is None
    assert raw.meals == ()
    assert raw.water == ()


def test_load_day_keeps_a_partial_goals_row(day: Day, schema: str) -> None:
    day.goals(kcal="2000", protein_g=None, carbs_g="210", fat_g=None, water_ml=None)

    raw = load_day(date(2026, 10, 30), url=day.url, tz=TZ, schema=schema)

    assert raw.goals == GoalsRow(
        kcal=Decimal("2000"), protein_g=None, carbs_g=Decimal("210"), fat_g=None, water_ml=None
    )
