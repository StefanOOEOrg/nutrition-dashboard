/**
 * Wire types of `GET /api/today` (see `server/nutrition_dashboard/day.py`).
 *
 * The server sends numbers only: grams, millilitres and kilocalories as they are stored. A goal
 * the user never set arrives as `null`; percentages are computed in the browser (`format.ts`).
 */

/** Daily targets; `null` = this goal was never set. */
export interface Goals {
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  water_ml: number | null;
}

/** What the day adds up to so far. */
export interface Totals {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  water_ml: number;
}

/** One logged minute: meals, water, or both. */
export interface Entry {
  /** Local wall-clock time, `HH:MM`. */
  time: string;
  kind: 'meal' | 'water';
  /** Distinct `meal_type` values of this minute, e.g. `['breakfast']`; empty for water only. */
  meal_types: string[];
  /** Foods of this minute; water appears as `<ml> ml` after the foods. */
  foods: string[];
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  water_ml: number;
}

/** Response of `GET /api/today`. */
export interface DayResponse {
  /** Local date, `YYYY-MM-DD`. */
  date: string;
  timezone: string;
  goals: Goals;
  totals: Totals;
  entries: Entry[];
}
