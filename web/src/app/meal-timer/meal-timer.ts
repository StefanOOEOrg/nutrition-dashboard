import { Component, computed, input } from '@angular/core';

import { breakText, minutesSince } from '../format';

/**
 * Length of a full meal break: five hours between two caloric intakes.
 *
 * A UI goal, not a formatter - `format.ts` stays free of product decisions and of any number
 * that could be tuned without touching the panel.
 */
export const MEAL_BREAK_GOAL_MINUTES = 300;

/**
 * The meal break panel: how long ago the last caloric intake was, as a bar toward the goal.
 *
 * Pure: it never reads the clock itself. The page hands in `nowMs` and owns the interval, so the
 * spec drives the clock by hand instead of faking timers.
 */
@Component({
  selector: 'app-meal-timer',
  templateUrl: './meal-timer.html',
  styleUrl: './meal-timer.css',
})
export class MealTimer {
  /** ISO timestamp of the last caloric intake with its offset, `null` when nothing was logged. */
  readonly lastMealAt = input<string | null>(null);
  /** Current time in epoch milliseconds, advanced by the page. */
  readonly nowMs = input.required<number>();

  /** The goal, exposed for `aria-valuemax`. */
  protected readonly goalMinutes = MEAL_BREAK_GOAL_MINUTES;

  /** Whole minutes since the last meal, `null` when there is none (see `minutesSince`). */
  readonly elapsed = computed<number | null>(() => minutesSince(this.lastMealAt(), this.nowMs()));

  /** `true` when a meal is logged - zero minutes is a meal too, so no truthiness test. */
  readonly hasMeal = computed<boolean>(() => this.elapsed() !== null);

  /** The elapsed time as text: `'4h 38m'`; `''` without a meal. */
  readonly elapsedText = computed<string>(() => {
    const minutes = this.elapsed();
    return minutes === null ? '' : breakText(minutes);
  });

  /** `min(1, elapsed / 300)` in percent: the bar's width, full from the goal on. */
  readonly percent = computed<number>(() => {
    const minutes = this.elapsed();
    return minutes === null ? 0 : Math.min(1, minutes / MEAL_BREAK_GOAL_MINUTES) * 100;
  });

  /** `elapsed` clamped to the goal - `aria-valuenow`, so it never exceeds `aria-valuemax`. */
  readonly ariaValueNow = computed<number>(() =>
    Math.min(MEAL_BREAK_GOAL_MINUTES, this.elapsed() ?? 0),
  );

  /** `true` from the goal on (inclusive). */
  readonly reached = computed<boolean>(() => (this.elapsed() ?? 0) >= MEAL_BREAK_GOAL_MINUTES);

  /** The line under the bar: `'Goal reached.'` from the goal on, otherwise `'<n>m to go'`. */
  readonly goalText = computed<string>(() => {
    const minutes = this.elapsed() ?? 0;
    return this.reached() ? 'Goal reached.' : `${MEAL_BREAK_GOAL_MINUTES - minutes}m to go`;
  });
}
