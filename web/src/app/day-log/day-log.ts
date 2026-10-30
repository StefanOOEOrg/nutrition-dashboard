import { Component, computed, input } from '@angular/core';

import { dayFraction, isOver, shareText } from '../format';
import { Entry, Goals } from '../models';

/** One dot on the day ribbon. */
export interface Marker {
  /** `'marker-0'`, `'marker-1'`, … in the order of `entries`. */
  testId: string;
  /** Position on the ribbon in percent of the day, `0..100`. */
  left: number;
  /** `true` for a water entry (draws a blue dot). */
  water: boolean;
  /** Tooltip: `'<time> <kind>'`, e.g. `'07:30 meal'` / `'10:44 water'`. */
  title: string;
}

/** One row of the log. */
export interface LogRow {
  time: string;
  kind: 'meal' | 'water';
  /** `'Breakfast'`, `'Snack'`, `'Lunch'`, `'Dinner'`, `'Drink'`; several types joined with `' · '`; `'Water'` for water rows. */
  kindLabel: string;
  foods: string[];
  /** `'554'` for a meal row, `''` for water. */
  kcal: string;
  /** `'28 %'` for a meal row, `''` for water. */
  kcalShare: string;
  /** Share of the protein goal, `'38 %'` or `'—'`; `'—'` for water. */
  protein: string;
  /** Share of the carb goal, `'—'` for water. */
  carbs: string;
  /** Share of the fat goal, `'—'` for water. */
  fat: string;
  /** `'2000'` for a water row, `''` for a meal row. */
  water: string;
  /** `'67 %'` for a water row, `''` for a meal row. */
  waterShare: string;
  over: { protein: boolean; carbs: boolean; fat: boolean };
}

/**
 * The right column of the dashboard: day ribbon on top, the log on a vertical time axis below.
 *
 * Both show the same times, so no numbering is needed: a dot on the ribbon sits at the same clock
 * time as the row in the log. Template and CSS are complete (see `docs/ui-mockup.html`); only the
 * computeds below are stubs.
 */
@Component({
  selector: 'app-day-log',
  templateUrl: './day-log.html',
  styleUrl: './day-log.css',
})
export class DayLog {
  /** The logged minutes of today, ascending - exactly what the server sent. */
  readonly entries = input.required<Entry[]>();
  /** Daily targets, needed for the percentages of a row. */
  readonly goals = input.required<Goals>();
  /** Current wall-clock time as `HH:MM` (the shell refreshes it on every load). */
  readonly nowLabel = input.required<string>();

  /**
   * One marker per entry: `testId = 'marker-<index>'`, `left = dayFraction(entry.time) * 100`,
   * `water = entry.kind === 'water'`, `title = '<time> <kind>'`.
   */
  readonly markers = computed<Marker[]>(() =>
    this.entries().map((entry, index) => ({
      testId: `marker-${index}`,
      left: dayFraction(entry.time) * 100,
      water: entry.kind === 'water',
      title: `${entry.time} ${entry.kind}`,
    })),
  );

  /** Position of the "now" line in percent: `dayFraction(nowLabel()) * 100`. */
  readonly nowLeft = computed<number>(() => dayFraction(this.nowLabel()) * 100);

  /**
   * One row per entry, in the order of `entries()`:
   * - `kindLabel`: `meal_types` with the first letter upper-cased and joined with `' · '`
   *   (`['breakfast']` -> `'Breakfast'`); `'Water'` when `meal_types` is empty.
   * - `foods`: `entry.foods` unchanged.
   * - meal row: `kcal = number1(entry.kcal)`, `kcalShare = shareText(entry.kcal, goals().kcal)`,
   *   `protein = shareText(entry.protein_g, goals().protein_g)` (same for carbs/fat),
   *   `water = ''`, `waterShare = ''`;
   *   `over` per macro from `isOver(value, goal)`.
   * - water row: `kcal = ''`, `kcalShare = ''`, `protein/carbs/fat = '—'`,
   *   `water = String(entry.water_ml)`, `waterShare = shareText(entry.water_ml, goals().water_ml)`,
   *   `over` all `false`.
   */
  readonly rows = computed<LogRow[]>(() => {
    const goals = this.goals();
    return this.entries().map((entry) => {
      const kindLabel =
        entry.meal_types.length === 0
          ? 'Water'
          : entry.meal_types
              .map((type) => type.charAt(0).toUpperCase() + type.slice(1))
              .join(' · ');
      const base = { time: entry.time, kind: entry.kind, kindLabel, foods: entry.foods };
      if (entry.kind === 'water') {
        return {
          ...base,
          kcal: '',
          kcalShare: '',
          protein: '—',
          carbs: '—',
          fat: '—',
          water: String(entry.water_ml),
          waterShare: shareText(entry.water_ml, goals.water_ml),
          over: { protein: false, carbs: false, fat: false },
        };
      }
      return {
        ...base,
        kcal: String(Math.round(entry.kcal)),
        kcalShare: shareText(entry.kcal, goals.kcal),
        protein: shareText(entry.protein_g, goals.protein_g),
        carbs: shareText(entry.carbs_g, goals.carbs_g),
        fat: shareText(entry.fat_g, goals.fat_g),
        water: '',
        waterShare: '',
        over: {
          protein: isOver(entry.protein_g, goals.protein_g),
          carbs: isOver(entry.carbs_g, goals.carbs_g),
          fat: isOver(entry.fat_g, goals.fat_g),
        },
      };
    });
  });

  /**
   * The quiet line at the end of the log:
   * - no entries -> `'Nothing logged yet.'`
   * - otherwise -> `'Nothing logged since <time of the last entry>.'`
   */
  readonly hint = computed<string>(() => {
    const entries = this.entries();
    if (entries.length === 0) {
      return 'Nothing logged yet.';
    }
    return `Nothing logged since ${entries[entries.length - 1].time}.`;
  });
}
