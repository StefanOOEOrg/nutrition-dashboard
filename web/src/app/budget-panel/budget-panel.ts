import { Component, computed, input } from '@angular/core';

import {
  RING_CIRCUMFERENCE,
  barWidth,
  isOver,
  number1,
  ringOffset,
  share,
  shareText,
} from '../format';
import { Goals, Totals } from '../models';

/** One macro row of the budget column (Protein, Carbs, Fat). */
export interface MacroRow {
  /** `'macro-protein'`, `'macro-carbs'`, `'macro-fat'` - the CSS/test id of the row. */
  testId: string;
  /** `'Protein'`, `'Carbs'`, `'Fat'`. */
  name: string;
  /** See `macroRows()` for the exact strings. */
  values: string;
  /** Only for an over-budget row, otherwise `null`. */
  hint: string | null;
  /** Bar width in percent, `0..100`. */
  width: number;
  over: boolean;
  noGoal: boolean;
}

/** One cell of the "Left today" block. */
export interface LeftCell {
  /** `'left-kcal'`, `'left-protein'`, `'left-carbs'`, `'left-fat'`, `'left-water'`. */
  testId: string;
  /** `'Calories'`, `'Protein'`, `'Carbs'`, `'Fat'`, `'Water'`. */
  label: string;
  /** See `leftCells()` for the exact strings. */
  value: string;
  /** `true` when the goal is exceeded (the cell is rendered red). */
  over: boolean;
}

/**
 * The left column of the dashboard: calorie ring, macro bars, water bar and "Left today".
 *
 * The template and the CSS are complete (they follow `docs/ui-mockup.html`); only the computeds
 * below are stubs. Every computed is a pure function of the three inputs and is expected to be
 * tested directly, without DOM.
 */
@Component({
  selector: 'app-budget-panel',
  templateUrl: './budget-panel.html',
  styleUrl: './budget-panel.css',
})
export class BudgetPanel {
  /** Daily targets from the server; a goal may be `null`. */
  readonly goals = input.required<Goals>();
  /** What has been logged today. */
  readonly totals = input.required<Totals>();
  /** Number of logged entries today (for the summary line of the ring card). */
  readonly entryCount = input.required<number>();

  /** `RING_CIRCUMFERENCE`, exposed for the template's `stroke-dasharray`. */
  protected readonly circumference = RING_CIRCUMFERENCE;

  /**
   * `share(totals().kcal, goals().kcal)` - the percentage of the calorie budget, `null` without a
   * goal.
   */
  readonly kcalShare = computed<number | null>(() => share(this.totals().kcal, this.goals().kcal));

  /**
   * `ringOffset(kcalShare())` - the `stroke-dashoffset` of the ring (see `format.ts`).
   */
  readonly ringOffsetValue = computed<number>(() => ringOffset(this.kcalShare()));

  /**
   * Percentage in the middle of the ring: `'81%'` - the rounded share without a space, `'—'`
   * when there is no calorie goal.
   */
  readonly kcalPercentText = computed<string>(() => {
    const percent = this.kcalShare();
    return percent === null ? '—' : `${Math.round(percent)}%`;
  });

  /**
   * Consumed calories as text, rounded to whole kcal: `String(Math.round(totals().kcal))`,
   * e.g. `'1624'` (nobody needs a decimal of a calorie).
   */
  readonly kcalText = computed<string>(() => String(Math.round(this.totals().kcal)));

  /** The calorie goal as text: `number1(goals().kcal)`, or `'—'` when it is `null`. */
  readonly calorieGoalText = computed<string>(() => {
    const goal = this.goals().kcal;
    return goal === null ? '—' : number1(goal);
  });

  /**
   * One line under the ring:
   * - no goal -> `'no calorie goal'`
   * - remaining >= 0 -> `'<n> kcal left today'` with `n = Math.round(goal - consumed)`
   * - remaining < 0 -> `'<n> kcal over the goal'` with `n = Math.round(-remaining)`
   */
  readonly kcalLeftText = computed<string>(() => {
    const goal = this.goals().kcal;
    if (goal === null) {
      return 'no calorie goal';
    }
    const remaining = goal - this.totals().kcal;
    return remaining >= 0
      ? `${Math.round(remaining)} kcal left today`
      : `${Math.round(-remaining)} kcal over the goal`;
  });

  /**
   * The three macro rows, always in the order protein, carbs, fat.
   *
   * Per row (`value` = `totals()` field, `goal` = `goals()` field, `unit` = `'g'`):
   * - goal set: `values = '<value> / <goal> g · <shareText>'`, e.g. `'134.8 / 130 g · 104 %'`
   * - goal `null`: `values = '<value> g · no goal'`
   * - `over = isOver(value, goal)`, `noGoal = goal === null`, `width = barWidth(value, goal)`
   * - `hint` only when over: `'<n> g over the daily goal'` with `n = Math.round(value - goal)`
   */
  readonly macroRows = computed<MacroRow[]>(() => {
    const totals = this.totals();
    const goals = this.goals();
    const macros = [
      { testId: 'macro-protein', name: 'Protein', value: totals.protein_g, goal: goals.protein_g },
      { testId: 'macro-carbs', name: 'Carbs', value: totals.carbs_g, goal: goals.carbs_g },
      { testId: 'macro-fat', name: 'Fat', value: totals.fat_g, goal: goals.fat_g },
    ];
    return macros.map((macro) => {
      const over = isOver(macro.value, macro.goal);
      return {
        testId: macro.testId,
        name: macro.name,
        values:
          macro.goal === null
            ? `${number1(macro.value)} g · no goal`
            : `${number1(macro.value)} / ${number1(macro.goal)} g · ` +
              shareText(macro.value, macro.goal),
        hint:
          over && macro.goal !== null
            ? `${Math.round(macro.value - macro.goal)} g over the daily goal`
            : null,
        width: barWidth(macro.value, macro.goal),
        over,
        noGoal: macro.goal === null,
      };
    });
  });

  /**
   * The water bar's value line:
   * - goal set: `'<ml> / <goal> ml · <shareText>'`, e.g. `'2000 / 3000 ml · 67 %'`
   * - goal `null`: `'<ml> ml · no goal'`
   */
  readonly waterValues = computed<string>(() => {
    const water = this.totals().water_ml;
    const goal = this.goals().water_ml;
    return goal === null
      ? `${number1(water)} ml · no goal`
      : `${number1(water)} / ${number1(goal)} ml · ${shareText(water, goal)}`;
  });

  /** Bar width of the water row: `barWidth(totals().water_ml, goals().water_ml)`. */
  readonly waterWidth = computed<number>(() =>
    barWidth(this.totals().water_ml, this.goals().water_ml),
  );

  /**
   * Hint under the water bar:
   * - no goal -> `''`
   * - remaining >= 0 -> `'<n> ml left'`
   * - remaining < 0 -> `'<n> ml over the goal'` with `n` as a positive number
   */
  readonly waterHint = computed<string>(() => {
    const goal = this.goals().water_ml;
    if (goal === null) {
      return '';
    }
    const remaining = goal - this.totals().water_ml;
    return remaining >= 0
      ? `${number1(remaining)} ml left`
      : `${number1(-remaining)} ml over the goal`;
  });

  /**
   * The cells of "Left today", always in the order kcal, protein, carbs, fat, water.
   *
   * Labels: `'Calories'`, `'Protein'`, `'Carbs'`, `'Fat'`, `'Water'`; test ids `'left-kcal'`,
   * `'left-protein'`, `'left-carbs'`, `'left-fat'`, `'left-water'`.
   *
   * Value per cell (`remaining = goal - consumed`):
   * - goal `null` -> `'—'`, `over = false`
   * - remaining >= 0 -> `'<n> kcal'` for calories (rounded to whole kcal with `Math.round`),
   *   `'<n> g'` for the macros and `'<n> ml'` for water (`number1`)
   * - remaining < 0 -> `'−<n> <unit>'` with a real minus sign `\u2212` and a positive `n`,
   *   `over = true` (e.g. `'−5 g'`); calories are rounded like above
   */
  readonly leftCells = computed<LeftCell[]>(() => {
    const totals = this.totals();
    const goals = this.goals();
    const cells = [
      {
        testId: 'left-kcal',
        label: 'Calories',
        consumed: totals.kcal,
        goal: goals.kcal,
        unit: 'kcal',
        format: (amount: number): string => String(Math.round(amount)),
      },
      {
        testId: 'left-protein',
        label: 'Protein',
        consumed: totals.protein_g,
        goal: goals.protein_g,
        unit: 'g',
        format: number1,
      },
      {
        testId: 'left-carbs',
        label: 'Carbs',
        consumed: totals.carbs_g,
        goal: goals.carbs_g,
        unit: 'g',
        format: number1,
      },
      {
        testId: 'left-fat',
        label: 'Fat',
        consumed: totals.fat_g,
        goal: goals.fat_g,
        unit: 'g',
        format: number1,
      },
      {
        testId: 'left-water',
        label: 'Water',
        consumed: totals.water_ml,
        goal: goals.water_ml,
        unit: 'ml',
        format: number1,
      },
    ];
    return cells.map((cell) => {
      if (cell.goal === null) {
        return { testId: cell.testId, label: cell.label, value: '—', over: false };
      }
      const remaining = cell.goal - cell.consumed;
      const over = remaining < 0;
      const amount = cell.format(over ? -remaining : remaining);
      return {
        testId: cell.testId,
        label: cell.label,
        value: over ? `\u2212${amount} ${cell.unit}` : `${amount} ${cell.unit}`,
        over,
      };
    });
  });
}
