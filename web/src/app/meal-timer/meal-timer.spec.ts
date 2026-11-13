import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MealTimer } from './meal-timer';

const MEAL_AT = '2026-10-30T06:17:00+01:00';

/** `nowMs` for a break of `minutes` after `MEAL_AT`. */
function nowAfter(minutes: number): number {
  return Date.parse(MEAL_AT) + minutes * 60_000;
}

function setup(lastMealAt: string | null, nowMs: number) {
  TestBed.configureTestingModule({ imports: [MealTimer] });
  const fixture = TestBed.createComponent(MealTimer);
  fixture.componentRef.setInput('lastMealAt', lastMealAt);
  fixture.componentRef.setInput('nowMs', nowMs);
  fixture.detectChanges();
  return {
    fixture,
    component: fixture.componentInstance,
    el: fixture.nativeElement as HTMLElement,
  };
}

function one(el: HTMLElement, testId: string): HTMLElement {
  const found = el.querySelector(`[data-testid="${testId}"]`);
  if (!found) {
    throw new Error(`no element with data-testid="${testId}"`);
  }
  return found as HTMLElement;
}

function maybe(el: HTMLElement, testId: string): HTMLElement | null {
  return el.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null;
}

function text(el: HTMLElement, testId: string): string {
  return (one(el, testId).textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** The bar element; its `aria-*` values describe the break. */
function bar(el: HTMLElement): HTMLElement {
  return one(el, 'meal-timer-bar');
}

/** Width of the bar's fill in percent. */
function barWidth(el: HTMLElement): number {
  const fill = bar(el).querySelector('i') as HTMLElement | null;
  if (!fill) {
    throw new Error('the bar has no fill');
  }
  return parseFloat(fill.style.width);
}

describe('MealTimer', () => {
  let fixture: ComponentFixture<MealTimer> | null = null;

  afterEach(() => {
    fixture?.destroy();
    fixture = null;
  });

  it('says so when no meal is logged and draws no bar at all', () => {
    const shell = setup(null, nowAfter(278));
    fixture = shell.fixture;

    expect(text(shell.el, 'meal-timer-empty')).toBe('No meal logged yet.');
    expect(maybe(shell.el, 'meal-timer-bar')).toBeNull();
    expect(maybe(shell.el, 'meal-timer-elapsed')).toBeNull();
    expect(maybe(shell.el, 'meal-timer-goal')).toBeNull();
  });

  it('counts the break and the minutes to go', () => {
    const shell = setup(MEAL_AT, nowAfter(278));
    fixture = shell.fixture;

    expect(shell.component.elapsed()).toBe(278);
    expect(shell.component.percent()).toBeCloseTo(92.6667, 3);
    expect(text(shell.el, 'meal-timer-elapsed')).toBe('4h 38m');
    expect(text(shell.el, 'meal-timer-goal')).toBe('22m to go');
    expect(barWidth(shell.el)).toBeCloseTo(92.6667, 3);
    expect(bar(shell.el).getAttribute('role')).toBe('progressbar');
    expect(bar(shell.el).getAttribute('aria-valuemin')).toBe('0');
    expect(bar(shell.el).getAttribute('aria-valuemax')).toBe('300');
    expect(bar(shell.el).getAttribute('aria-valuenow')).toBe('278');
    expect(maybe(shell.el, 'meal-timer-empty')).toBeNull();
  });

  it('is still counting one minute before the goal', () => {
    const shell = setup(MEAL_AT, nowAfter(299));
    fixture = shell.fixture;

    expect(text(shell.el, 'meal-timer-elapsed')).toBe('4h 59m');
    expect(text(shell.el, 'meal-timer-goal')).toBe('1m to go');
    expect(barWidth(shell.el)).toBeCloseTo(99.6667, 3);
    expect(bar(shell.el).getAttribute('aria-valuenow')).toBe('299');
  });

  it('reaches the goal at exactly 300 minutes', () => {
    const shell = setup(MEAL_AT, nowAfter(300));
    fixture = shell.fixture;

    expect(shell.component.elapsed()).toBe(300);
    expect(shell.component.percent()).toBe(100);
    expect(text(shell.el, 'meal-timer-elapsed')).toBe('5h 00m');
    expect(text(shell.el, 'meal-timer-goal')).toBe('Goal reached.');
    expect(barWidth(shell.el)).toBe(100);
    expect(bar(shell.el).getAttribute('aria-valuenow')).toBe('300');
  });

  it('caps the bar and aria-valuenow for a 31 hour break', () => {
    const shell = setup(MEAL_AT, nowAfter(1872));
    fixture = shell.fixture;

    expect(text(shell.el, 'meal-timer-elapsed')).toBe('31h 12m');
    expect(text(shell.el, 'meal-timer-goal')).toBe('Goal reached.');
    expect(shell.component.percent()).toBe(100);
    expect(barWidth(shell.el)).toBe(100);
    expect(bar(shell.el).getAttribute('aria-valuenow')).toBe('300');
  });

  it('counts zero minutes right after a meal instead of showing the empty state', () => {
    const shell = setup(MEAL_AT, nowAfter(0));
    fixture = shell.fixture;

    expect(text(shell.el, 'meal-timer-elapsed')).toBe('0h 00m');
    expect(text(shell.el, 'meal-timer-goal')).toBe('300m to go');
    expect(barWidth(shell.el)).toBe(0);
    expect(maybe(shell.el, 'meal-timer-empty')).toBeNull();
  });
});
