/**
 * Pure formatting helpers: numbers in, text out. No Angular, no state - every function is
 * independently testable (see `format.spec.ts`).
 *
 * Two rules run through all of them:
 * - A goal of `null` (never set in the diary) is not an error and not zero: functions that need a
 *   goal return `null` / an empty state instead of a number.
 * - Text is English, units are separated by a normal space (`'28 %'`, `'134.8 g'`).
 */

/** Radius of the calorie ring in the SVG viewBox (mockup: `r="54"`). */
export const RING_RADIUS = 54;

/** Circumference of the calorie ring, the value for `stroke-dasharray`. */
export const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * Percentage of a goal, not rounded and not clamped: `share(554, 2000)` -> `27.7`.
 *
 * `null` when the goal is `null` or not positive - both mean "there is no budget to divide by".
 */
export function share(value: number, goal: number | null): number | null {
  if (goal === null || goal <= 0) {
    return null;
  }
  return (value / goal) * 100;
}

/** `share()` as display text: `'28 %'`, or `'—'` (em dash) when there is no goal. */
export function shareText(value: number, goal: number | null): string {
  const percent = share(value, goal);
  return percent === null ? '—' : `${Math.round(percent)} %`;
}

/** `true` when a goal exists and the value is strictly above it (`value > goal`). */
export function isOver(value: number, goal: number | null): boolean {
  return goal !== null && value > goal;
}

/**
 * One decimal at most, as text: `134.8` -> `'134.8'`, `170` -> `'170'`, `1624.44` -> `'1624.4'`.
 *
 * Round to one decimal first (`Math.round(value * 10) / 10`), then format: a trailing `.0` is
 * dropped because JavaScript's number-to-string does that by itself.
 */
export function number1(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/**
 * Bar width in percent, clamped to `0..100`: `barWidth(134.8, 130)` -> `100` (the bar is full and
 * the row is marked over separately), `barWidth(107.1, 210)` -> `51`.
 *
 * `0` when the goal is `null` or not positive.
 */
export function barWidth(value: number, goal: number | null): number {
  const percent = share(value, goal);
  if (percent === null) {
    return 0;
  }
  return Math.min(100, Math.max(0, percent));
}

/**
 * `stroke-dashoffset` of the calorie ring for a percentage: with `share` in `0..100` the visible
 * arc is `share` percent of `RING_CIRCUMFERENCE`, so the offset is
 * `RING_CIRCUMFERENCE * (1 - share / 100)`.
 *
 * Clamped to `0..RING_CIRCUMFERENCE` (150 % of the budget draws a full ring, not more).
 * `null` (no goal) -> a full offset, i.e. an empty ring.
 */
export function ringOffset(sharePercent: number | null): number {
  if (sharePercent === null) {
    return RING_CIRCUMFERENCE;
  }
  const clamped = Math.min(100, Math.max(0, sharePercent));
  return RING_CIRCUMFERENCE * (1 - clamped / 100);
}

/**
 * Position of a local time on the day ribbon as a fraction of the day, `0..1`:
 * `dayFraction('12:00')` -> `0.5`, `dayFraction('13:54')` -> `0.5798611111111112`.
 *
 * Input is `HH:MM`. Anything that is not two valid numbers (`'abc'`, `''`, `'25:99'`) -> `0`.
 */
export function dayFraction(time: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (match === null) {
    return 0;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return 0;
  }
  return (hours * 60 + minutes) / 1440;
}

/** Wall-clock label of a `Date` in the browser's zone: `'09:05'`, `'14:09'` (two digits each). */
export function clockLabel(now: Date): string {
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * `YYYY-MM-DD` as a long English date: `'2026-10-30'` -> `'Friday, 30 October 2026'`.
 *
 * Use `Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long',
 * year: 'numeric' })` on a date built from the string at **12:00 UTC**, so no time zone can push
 * it to the neighbouring day. An unparsable string comes back unchanged.
 */
export function dateLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
