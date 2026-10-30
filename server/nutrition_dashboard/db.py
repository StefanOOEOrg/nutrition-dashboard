"""Read-only Postgres access: the meals, water and goals of one day.

The dashboard never writes. One short-lived connection per request, no pooling, no ORM - the
schema (``nutrition`` in the mcp-nutrition container) belongs to the MCP servers.
"""

from datetime import date

from .models import RawDay


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
    raise NotImplementedError
