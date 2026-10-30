import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BudgetPanel } from './budget-panel';
import { RING_CIRCUMFERENCE } from '../format';
import { Goals, Totals } from '../models';

const GOALS: Goals = { kcal: 2000, protein_g: 130, carbs_g: 210, fat_g: 70, water_ml: 3000 };
const TOTALS: Totals = {
  kcal: 1624.4,
  protein_g: 134.8,
  carbs_g: 107.1,
  fat_g: 71.2,
  water_ml: 2000,
};

const NO_GOALS: Goals = { kcal: null, protein_g: null, carbs_g: null, fat_g: null, water_ml: null };
const EMPTY: Totals = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, water_ml: 0 };

function setup(goals: Goals = GOALS, totals: Totals = TOTALS, entryCount = 5) {
  TestBed.configureTestingModule({ imports: [BudgetPanel] });
  const fixture = TestBed.createComponent(BudgetPanel);
  fixture.componentRef.setInput('goals', goals);
  fixture.componentRef.setInput('totals', totals);
  fixture.componentRef.setInput('entryCount', entryCount);
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

function text(el: HTMLElement, testId: string): string {
  return (one(el, testId).textContent ?? '').trim();
}

describe('BudgetPanel', () => {
  let fixture: ComponentFixture<BudgetPanel> | null = null;

  afterEach(() => {
    fixture?.destroy();
    fixture = null;
  });

  it('shows the calorie ring for the budget', () => {
    const shell = setup();
    fixture = shell.fixture;

    expect(shell.component.kcalShare()).toBeCloseTo(81.22, 2);
    expect(shell.component.ringOffsetValue()).toBeCloseTo(RING_CIRCUMFERENCE * 0.1878, 2);
    expect(text(shell.el, 'kcal-percent')).toBe('81%');
    expect(text(shell.el, 'kcal-total')).toBe('1624 / 2000 kcal');
    expect(text(shell.el, 'kcal-left')).toBe('376 kcal left today');
    expect(text(shell.el, 'entry-count')).toBe('5 entries · water 2000 ml');
  });

  it('describes an exceeded calorie budget', () => {
    const shell = setup(GOALS, { ...TOTALS, kcal: 2200 });
    fixture = shell.fixture;

    expect(shell.component.kcalPercentText()).toBe('110%');
    expect(shell.component.ringOffsetValue()).toBe(0);
    expect(shell.component.kcalLeftText()).toBe('200 kcal over the goal');
  });

  it('reports a missing calorie goal instead of a percentage', () => {
    const shell = setup(NO_GOALS, TOTALS);
    fixture = shell.fixture;

    expect(shell.component.kcalShare()).toBeNull();
    expect(shell.component.kcalPercentText()).toBe('—');
    expect(shell.component.calorieGoalText()).toBe('—');
    expect(shell.component.kcalLeftText()).toBe('no calorie goal');
    expect(shell.component.ringOffsetValue()).toBeCloseTo(RING_CIRCUMFERENCE, 6);
  });

  it('builds one row per macro, in the order protein, carbs, fat', () => {
    const shell = setup();
    fixture = shell.fixture;

    const rows = shell.component.macroRows();
    expect(rows.map((row) => row.testId)).toEqual(['macro-protein', 'macro-carbs', 'macro-fat']);
    expect(rows.map((row) => row.name)).toEqual(['Protein', 'Carbs', 'Fat']);
    expect(rows[0].values).toBe('134.8 / 130 g · 104 %');
    expect(rows[1].values).toBe('107.1 / 210 g · 51 %');
    expect(rows[2].values).toBe('71.2 / 70 g · 102 %');
    expect(rows.map((row) => row.over)).toEqual([true, false, true]);
    expect(rows.map((row) => row.noGoal)).toEqual([false, false, false]);
    expect(rows[0].width).toBe(100);
    expect(rows[1].width).toBeCloseTo(51, 1);
    expect(rows[2].width).toBe(100);
    expect(rows[0].hint).toBe('5 g over the daily goal');
    expect(rows[1].hint).toBeNull();
    expect(rows[2].hint).toBe('1 g over the daily goal');
  });

  it('renders the macro rows with their over state and hint', () => {
    const shell = setup();
    fixture = shell.fixture;

    const protein = one(shell.el, 'macro-protein');
    expect((protein.querySelector('.row-vals') as HTMLElement).textContent?.trim()).toBe(
      '134.8 / 130 g · 104 %',
    );
    expect((protein.querySelector('.bar') as HTMLElement).classList).toContain('over');
    expect((protein.querySelector('.hint') as HTMLElement).textContent?.trim()).toBe(
      '5 g over the daily goal',
    );

    const carbs = one(shell.el, 'macro-carbs');
    expect((carbs.querySelector('.bar') as HTMLElement).classList).not.toContain('over');
    expect(carbs.querySelector('.hint')).toBeNull();
  });

  it('shows a macro without a goal as grams without a bar share', () => {
    const shell = setup({ ...GOALS, carbs_g: null });
    fixture = shell.fixture;

    const carbs = shell.component.macroRows()[1];
    expect(carbs.values).toBe('107.1 g · no goal');
    expect(carbs.noGoal).toBe(true);
    expect(carbs.width).toBe(0);
    expect(carbs.over).toBe(false);
    expect((one(shell.el, 'macro-carbs').querySelector('.bar') as HTMLElement).classList).toContain(
      'nogoal',
    );
  });

  it('describes the water budget', () => {
    const shell = setup();
    fixture = shell.fixture;

    expect(shell.component.waterValues()).toBe('2000 / 3000 ml · 67 %');
    expect(shell.component.waterWidth()).toBeCloseTo(66.67, 1);
    expect(shell.component.waterHint()).toBe('1000 ml left');
    expect(text(shell.el, 'water-values')).toBe('2000 / 3000 ml · 67 %');
    expect(text(shell.el, 'water-hint')).toBe('1000 ml left');
  });

  it('describes water without a goal', () => {
    const shell = setup({ ...GOALS, water_ml: null });
    fixture = shell.fixture;

    expect(shell.component.waterValues()).toBe('2000 ml · no goal');
    expect(shell.component.waterWidth()).toBe(0);
    expect(shell.component.waterHint()).toBe('');
  });

  it('describes water over the goal', () => {
    const shell = setup(GOALS, { ...TOTALS, water_ml: 3200 });
    fixture = shell.fixture;

    expect(shell.component.waterHint()).toBe('200 ml over the goal');
  });

  it('lists what is left today, including the exceeded values', () => {
    const shell = setup();
    fixture = shell.fixture;

    const cells = shell.component.leftCells();
    expect(cells.map((cell) => cell.testId)).toEqual([
      'left-kcal',
      'left-protein',
      'left-carbs',
      'left-fat',
      'left-water',
    ]);
    expect(cells.map((cell) => cell.label)).toEqual([
      'Calories',
      'Protein',
      'Carbs',
      'Fat',
      'Water',
    ]);
    expect(cells.map((cell) => cell.value)).toEqual([
      '376 kcal',
      '−4.8 g',
      '102.9 g',
      '−1.2 g',
      '1000 ml',
    ]);
    expect(cells.map((cell) => cell.over)).toEqual([false, true, false, true, false]);
    expect(text(shell.el, 'left-protein')).toContain('−4.8 g');
    expect(one(shell.el, 'left-protein').querySelector('.val')?.classList).toContain('over-text');
  });

  it('shows a dash for every goal that is not set', () => {
    const shell = setup(NO_GOALS, TOTALS);
    fixture = shell.fixture;

    expect(shell.component.leftCells().map((cell) => cell.value)).toEqual([
      '—',
      '—',
      '—',
      '—',
      '—',
    ]);
    expect(shell.component.leftCells().every((cell) => !cell.over)).toBe(true);
  });

  it('handles a day without any entry', () => {
    const shell = setup(GOALS, EMPTY, 0);
    fixture = shell.fixture;

    expect(shell.component.kcalPercentText()).toBe('0%');
    expect(shell.component.kcalLeftText()).toBe('2000 kcal left today');
    expect(text(shell.el, 'entry-count')).toBe('0 entries · water 0 ml');
  });
});
