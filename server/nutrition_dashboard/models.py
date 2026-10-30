"""Row types the database layer hands to the day aggregation (fully implemented, no stub)."""

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal


@dataclass(frozen=True)
class MealRow:
    """One row of ``<schema>.meals``, restricted to the columns the dashboard reads."""

    eaten_at: datetime
    meal_type: str
    name: str
    components: str | None
    kcal: Decimal
    protein_g: Decimal
    carbs_g: Decimal
    fat_g: Decimal


@dataclass(frozen=True)
class WaterRow:
    """One row of ``<schema>.water``."""

    drunk_at: datetime
    ml: int


@dataclass(frozen=True)
class GoalsRow:
    """The single row of ``<schema>.goals``; a column the user never set comes back as ``None``."""

    kcal: Decimal | None
    protein_g: Decimal | None
    carbs_g: Decimal | None
    fat_g: Decimal | None
    water_ml: int | None


@dataclass(frozen=True)
class RawDay:
    """Everything one day produced, still ungrouped and in database order."""

    meals: tuple[MealRow, ...]
    water: tuple[WaterRow, ...]
    goals: GoalsRow | None
