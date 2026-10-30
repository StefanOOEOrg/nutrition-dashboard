"""Fixtures for the server tests.

The database tests run against a real Postgres: ``TEST_DATABASE_URL`` points at a database where
the role may create schemas. Every test gets its own throwaway schema, so the real ``nutrition``
schema is never touched. Without ``TEST_DATABASE_URL`` the database tests skip locally; in CI set
``TEST_REQUIRE_DB=1`` to turn the skip into a failure.
"""

import os
import uuid
from collections.abc import Iterator
from datetime import datetime

import psycopg
import pytest
from psycopg import sql

# Mirrors the columns the dashboard reads from the mcp-nutrition schema.
DDL = """
create table {schema}.meals (
  id          serial primary key,
  eaten_at    timestamptz not null,
  meal_type   text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack', 'drink')),
  name        text not null,
  components  text,
  kcal        numeric not null check (kcal >= 0),
  protein_g   numeric not null check (protein_g >= 0),
  carbs_g     numeric not null check (carbs_g >= 0),
  fat_g       numeric not null check (fat_g >= 0)
);
create table {schema}.water (
  id       serial primary key,
  drunk_at timestamptz not null,
  ml       integer not null check (ml > 0)
);
create table {schema}.goals (
  id         integer primary key default 1 check (id = 1),
  kcal       numeric,
  protein_g  numeric,
  carbs_g    numeric,
  fat_g      numeric,
  water_ml   integer
);
"""


@pytest.fixture(scope="session")
def database_url() -> str:
    """libpq URL of the test database; skips (or fails with ``TEST_REQUIRE_DB=1``) when unset."""
    url = os.environ.get("TEST_DATABASE_URL", "")
    if url:
        return url
    if os.environ.get("TEST_REQUIRE_DB") == "1":
        pytest.fail("TEST_REQUIRE_DB=1 but TEST_DATABASE_URL is empty")
    pytest.skip("TEST_DATABASE_URL not set - skipping database tests")


@pytest.fixture()
def schema(database_url: str) -> Iterator[str]:
    """A fresh schema with the three tables, dropped after the test."""
    name = f"test_dashboard_{uuid.uuid4().hex[:10]}"
    with psycopg.connect(database_url, autocommit=True) as conn:
        conn.execute(sql.SQL("create schema {}").format(sql.Identifier(name)))
        conn.execute(sql.SQL(DDL).format(schema=sql.Identifier(name)))
        try:
            yield name
        finally:
            conn.execute(sql.SQL("drop schema {} cascade").format(sql.Identifier(name)))


class Day:
    """Helpers that write rows into one test schema."""

    def __init__(self, url: str, schema: str) -> None:
        self.url = url
        self.schema = schema

    def meal(
        self,
        eaten_at: datetime,
        *,
        meal_type: str = "lunch",
        name: str = "Meal",
        components: str | None = None,
        kcal: str = "100",
        protein_g: str = "10",
        carbs_g: str = "10",
        fat_g: str = "5",
    ) -> None:
        with psycopg.connect(self.url, autocommit=True) as conn:
            conn.execute(
                sql.SQL(
                    "insert into {schema}.meals "
                    "(eaten_at, meal_type, name, components, kcal, protein_g, carbs_g, fat_g) "
                    "values (%s, %s, %s, %s, %s, %s, %s, %s)"
                ).format(schema=sql.Identifier(self.schema)),
                (eaten_at, meal_type, name, components, kcal, protein_g, carbs_g, fat_g),
            )

    def water(self, drunk_at: datetime, ml: int) -> None:
        with psycopg.connect(self.url, autocommit=True) as conn:
            conn.execute(
                sql.SQL("insert into {schema}.water (drunk_at, ml) values (%s, %s)").format(
                    schema=sql.Identifier(self.schema)
                ),
                (drunk_at, ml),
            )

    def goals(
        self,
        *,
        kcal: str | None = "2000",
        protein_g: str | None = "130",
        carbs_g: str | None = "210",
        fat_g: str | None = "70",
        water_ml: int | None = 3000,
    ) -> None:
        with psycopg.connect(self.url, autocommit=True) as conn:
            conn.execute(
                sql.SQL(
                    "insert into {schema}.goals (id, kcal, protein_g, carbs_g, fat_g, water_ml) "
                    "values (1, %s, %s, %s, %s, %s)"
                ).format(schema=sql.Identifier(self.schema)),
                (kcal, protein_g, carbs_g, fat_g, water_ml),
            )


@pytest.fixture()
def day(database_url: str, schema: str) -> Day:
    """Write helper bound to the throwaway schema of this test."""
    return Day(database_url, schema)
