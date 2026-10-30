import { describe, expect, it } from 'vitest';

import {
  RING_CIRCUMFERENCE,
  barWidth,
  clockLabel,
  dateLabel,
  dayFraction,
  isOver,
  number1,
  ringOffset,
  share,
  shareText,
} from './format';

describe('share', () => {
  it('returns the unrounded percentage of the goal', () => {
    expect(share(554, 2000)).toBeCloseTo(27.7, 10);
    expect(share(2000, 2000)).toBe(100);
    expect(share(2200, 2000)).toBeCloseTo(110, 10);
  });

  it('returns null without a usable goal', () => {
    expect(share(554, null)).toBeNull();
    expect(share(554, 0)).toBeNull();
  });
});

describe('shareText', () => {
  it('rounds to whole percent with a space before the sign', () => {
    expect(shareText(554, 2000)).toBe('28 %');
    expect(shareText(134.8, 130)).toBe('104 %');
    expect(shareText(730.4, 2000)).toBe('37 %');
  });

  it('uses an em dash when there is no goal', () => {
    expect(shareText(35.6, null)).toBe('—');
  });
});

describe('isOver', () => {
  it('is strict and needs a goal', () => {
    expect(isOver(134.8, 130)).toBe(true);
    expect(isOver(130, 130)).toBe(false);
    expect(isOver(71.2, 70)).toBe(true);
  });

  it('is false without a goal', () => {
    expect(isOver(999, null)).toBe(false);
  });
});

describe('number1', () => {
  it('keeps at most one decimal and drops a trailing zero', () => {
    expect(number1(134.8)).toBe('134.8');
    expect(number1(170)).toBe('170');
    expect(number1(1624.44)).toBe('1624.4');
    expect(number1(0)).toBe('0');
  });
});

describe('barWidth', () => {
  it('is the percentage of the goal, clamped to 100', () => {
    expect(barWidth(134.8, 130)).toBe(100);
    expect(barWidth(107.1, 210)).toBeCloseTo(51, 6);
    expect(barWidth(35, 70)).toBeCloseTo(50, 6);
  });

  it('is zero without a goal or for a negative value', () => {
    expect(barWidth(50, null)).toBe(0);
    expect(barWidth(-5, 100)).toBe(0);
  });
});

describe('ringOffset', () => {
  it('maps the percentage onto the circumference', () => {
    expect(ringOffset(0)).toBeCloseTo(RING_CIRCUMFERENCE, 6);
    expect(ringOffset(50)).toBeCloseTo(RING_CIRCUMFERENCE / 2, 6);
    expect(ringOffset(100)).toBeCloseTo(0, 6);
    expect(ringOffset(81.2)).toBeCloseTo(RING_CIRCUMFERENCE * 0.188, 6);
  });

  it('clamps at both ends', () => {
    expect(ringOffset(150)).toBeCloseTo(0, 6);
    expect(ringOffset(-10)).toBeCloseTo(RING_CIRCUMFERENCE, 6);
  });

  it('is an empty ring without a goal', () => {
    expect(ringOffset(null)).toBeCloseTo(RING_CIRCUMFERENCE, 6);
  });
});

describe('dayFraction', () => {
  it('places a local time on a 24 hour day', () => {
    expect(dayFraction('00:00')).toBe(0);
    expect(dayFraction('12:00')).toBe(0.5);
    expect(dayFraction('13:54')).toBeCloseTo(834 / 1440, 10);
    expect(dayFraction('24:00')).toBe(0);
  });

  it('returns 0 for anything that is not a valid HH:MM', () => {
    expect(dayFraction('')).toBe(0);
    expect(dayFraction('abc')).toBe(0);
    expect(dayFraction('25:99')).toBe(0);
    expect(dayFraction('1:5')).toBe(0);
  });
});

describe('clockLabel', () => {
  it('pads hours and minutes to two digits', () => {
    expect(clockLabel(new Date(2026, 9, 30, 9, 5))).toBe('09:05');
    expect(clockLabel(new Date(2026, 9, 30, 14, 9))).toBe('14:09');
  });
});

describe('dateLabel', () => {
  it('renders a long English date', () => {
    expect(dateLabel('2026-10-30')).toBe('Friday, 30 October 2026');
  });

  it('returns unparsable input unchanged', () => {
    expect(dateLabel('nope')).toBe('nope');
  });
});
