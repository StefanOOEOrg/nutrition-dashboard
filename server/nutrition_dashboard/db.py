"""Read-only Postgres access: the meals, water and goals of one day.

The dashboard never writes. One short-lived connection per request, no pooling, no ORM - the
schema (``nutrition`` in the mcp-nutrition container) belongs to the MCP servers.
"""

from datetime import date

import psycopg
from psycopg import sql

from .day import day_bounds
from .models import GoalsRow, MealRow, RawDay, WaterRow


def load_day(day: date, *, url: str, tz: str, schema: str = "nutrition") -> RawDay:
    """Read one calendar day and return its rows as ``RawDay``.

    Required behaviour:
    - Open a connection for this call only (``with psycopg.connect(url) as conn``), do not cache
      it: the dashboard runs as a local tool and idle connections are not worth the trouble.
    - Take the interval from ``day.day_bounds(day, tz)`` (import it from ``.day``) and query
      ``eaten_at >= start and eaten_at < end`` / ``drunk_at >= start and drunk_at < end``.
    - Meals: select ``eaten_at, meal_type, name, components, kcal, protein_g, carbs_g, fat_g``
      ordered by ``eaten_at``, then ``name``. Water: ``drunk_at, ml`` ordered by ``drunk_at``.
      Goals: the single row, ``id = 1``, columns ``kcal, protein_g, carbs_g, fat_g, water_ml``;
      a missing row is not an error -> ``goals=None``.
    - The schema name comes from the ``schema`` argument and must go through
      ``psycopg.sql.Identifier`` inside ``psycopg.sql.SQL(...)``; never build SQL by string
      concatenation or f-strings.
    - Map rows to the dataclasses of ``.models`` / ``.day``; keep ``Decimal`` and ``datetime``
      as they come, do not format anything here.
    - ``RawDay.meals`` and ``RawDay.water`` are tuples in database order.
    - Connection errors, missing tables and SQL errors propagate unchanged: ``app.py`` turns them
      into one readable error response.
    """
    start, end = day_bounds(day, tz)
    with psycopg.connect(url) as conn:
        meal_rows = conn.execute(
            sql.SQL(
                "select eaten_at, meal_type, name, components, kcal, protein_g, carbs_g, fat_g"
                " from {schema}.meals where eaten_at >= %s and eaten_at < %s"
                " order by eaten_at, name"
            ).format(schema=sql.Identifier(schema)),
            (start, end),
        ).fetchall()
        water_rows = conn.execute(
            sql.SQL(
                "select drunk_at, ml from {schema}.water"
                " where drunk_at >= %s and drunk_at < %s order by drunk_at"
            ).format(schema=sql.Identifier(schema)),
            (start, end),
        ).fetchall()
        goals_row = conn.execute(
            sql.SQL(
                "select kcal, protein_g, carbs_g, fat_g, water_ml from {schema}.goals where id = 1"
            ).format(schema=sql.Identifier(schema))
        ).fetchone()

    return RawDay(
        meals=tuple(MealRow(*row) for row in meal_rows),
        water=tuple(WaterRow(*row) for row in water_rows),
        goals=None if goals_row is None else GoalsRow(*goals_row),
    )
