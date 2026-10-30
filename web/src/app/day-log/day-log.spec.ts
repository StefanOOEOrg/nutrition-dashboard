import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DayLog } from './day-log';
import { Entry, Goals } from '../models';

const GOALS: Goals = { kcal: 2000, protein_g: 130, carbs_g: 210, fat_g: 70, water_ml: 3000 };

const ENTRIES: Entry[] = [
  {
    time: '07:30',
    kind: 'meal',
    meal_types: ['breakfast'],
    foods: ['Kaffee mit Milch 1 Tasse', 'Overnight Oats Bowl 1 Portion'],
    kcal: 554,
    protein_g: 49.3,
    carbs_g: 58.2,
    fat_g: 12.9,
    water_ml: 0,
  },
  {
    time: '10:44',
    kind: 'water',
    meal_types: [],
    foods: ['2000 ml'],
    kcal: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    water_ml: 2000,
  },
  {
    time: '11:31',
    kind: 'meal',
    meal_types: ['snack'],
    foods: ['High Protein Milchreis 1 Portion'],
    kcal: 170,
    protein_g: 15,
    carbs_g: 21,
    fat_g: 3,
    water_ml: 0,
  },
  {
    time: '12:00',
    kind: 'meal',
    meal_types: ['lunch'],
    foods: ['2 Eier', 'Faschiertes & Zwiebeln'],
    kcal: 730.4,
    protein_g: 55.5,
    carbs_g: 6.9,
    fat_g: 52.3,
    water_ml: 0,
  },
];

function setup(entries: Entry[] = ENTRIES, goals: Goals = GOALS, nowLabel = '14:09') {
  TestBed.configureTestingModule({ imports: [DayLog] });
  const fixture = TestBed.createComponent(DayLog);
  fixture.componentRef.setInput('entries', entries);
  fixture.componentRef.setInput('goals', goals);
  fixture.componentRef.setInput('nowLabel', nowLabel);
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
  return (one(el, testId).textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('DayLog', () => {
  let fixture: ComponentFixture<DayLog> | null = null;

  afterEach(() => {
    fixture?.destroy();
    fixture = null;
  });

  it('puts one marker on the ribbon per entry', () => {
    const shell = setup();
    fixture = shell.fixture;

    const markers = shell.component.markers();
    expect(markers).toHaveLength(4);
    expect(markers.map((marker) => marker.testId)).toEqual([
      'marker-0',
      'marker-1',
      'marker-2',
      'marker-3',
    ]);
    expect(markers[0].left).toBeCloseTo(31.25, 6);
    expect(markers[1].left).toBeCloseTo(644 / 14.4, 6);
    expect(markers[3].left).toBeCloseTo(50, 6);
    expect(markers.map((marker) => marker.water)).toEqual([false, true, false, false]);
    expect(markers[1].title).toBe('10:44 water');
    expect(markers[0].title).toBe('07:30 meal');
    expect(shell.el.querySelectorAll('.ribbon .dot')).toHaveLength(4);
    expect(one(shell.el, 'marker-1').classList).toContain('water');
  });

  it('marks the current time on the ribbon', () => {
    const shell = setup(ENTRIES, GOALS, '14:09');
    fixture = shell.fixture;

    expect(shell.component.nowLeft()).toBeCloseTo(849 / 14.4, 6);
    expect(text(shell.el, 'now-label')).toBe('14:09');
  });

  it('describes a meal row with kcal and percentages', () => {
    const shell = setup();
    fixture = shell.fixture;

    const row = shell.component.rows()[0];
    expect(row.time).toBe('07:30');
    expect(row.kind).toBe('meal');
    expect(row.kindLabel).toBe('Breakfast');
    expect(row.foods).toEqual(['Kaffee mit Milch 1 Tasse', 'Overnight Oats Bowl 1 Portion']);
    expect(row.kcal).toBe('554');
    expect(row.kcalShare).toBe('28 %');
    expect(row.protein).toBe('38 %');
    expect(row.carbs).toBe('28 %');
    expect(row.fat).toBe('18 %');
    expect(row.over).toEqual({ protein: false, carbs: false, fat: false });
    expect(row.water).toBe('');
    expect(row.waterShare).toBe('');
  });

  it('reports the shares of a row that stays inside its goals', () => {
    const shell = setup();
    fixture = shell.fixture;

    const row = shell.component.rows()[3];
    expect(row.kcal).toBe('730');
    expect(row.kcalShare).toBe('37 %');
    expect(row.protein).toBe('43 %');
    expect(row.fat).toBe('75 %');
    expect(row.over.fat).toBe(false);
    expect(row.over.protein).toBe(false);
  });

  it('marks an exceeded macro in its row', () => {
    const heavy: Entry = {
      time: '18:00',
      kind: 'meal',
      meal_types: ['dinner'],
      foods: ['Raclette 300 g'],
      kcal: 950,
      protein_g: 40,
      carbs_g: 10,
      fat_g: 78,
      water_ml: 0,
    };
    const shell = setup([heavy]);
    fixture = shell.fixture;

    const row = shell.component.rows()[0];
    expect(row.fat).toBe('111 %');
    expect(row.over.fat).toBe(true);
    expect(row.over.protein).toBe(false);
    const fatCell = one(shell.el, 'entry-18:00').querySelectorAll('.nums .m')[2] as HTMLElement;
    expect(fatCell.classList).toContain('over');
  });

  it('describes a water row without macros', () => {
    const shell = setup();
    fixture = shell.fixture;

    const row = shell.component.rows()[1];
    expect(row.kind).toBe('water');
    expect(row.kindLabel).toBe('Water');
    expect(row.kcal).toBe('');
    expect(row.kcalShare).toBe('');
    expect(row.protein).toBe('—');
    expect(row.carbs).toBe('—');
    expect(row.fat).toBe('—');
    expect(row.water).toBe('2000');
    expect(row.waterShare).toBe('67 %');
    expect(row.over).toEqual({ protein: false, carbs: false, fat: false });
  });

  it('renders the foods of a row separated by a middle dot', () => {
    const shell = setup();
    fixture = shell.fixture;

    expect(text(shell.el, 'foods-07:30')).toBe(
      'Kaffee mit Milch 1 Tasse · Overnight Oats Bowl 1 Portion',
    );
    expect(text(shell.el, 'foods-10:44')).toBe('2000 ml');
  });

  it('joins several meal types and capitalises them', () => {
    const entry: Entry = {
      time: '17:00',
      kind: 'meal',
      meal_types: ['drink', 'snack'],
      foods: ['Holy Scoop'],
      kcal: 20,
      protein_g: 0,
      carbs_g: 7,
      fat_g: 0,
      water_ml: 0,
    };
    const shell = setup([entry]);
    fixture = shell.fixture;

    expect(shell.component.rows()[0].kindLabel).toBe('Drink · Snack');
    expect(shell.component.hint()).toBe('Nothing logged since 17:00.');
  });

  it('shows a dash for macros without a goal', () => {
    const shell = setup(ENTRIES, { ...GOALS, protein_g: null, carbs_g: null });
    fixture = shell.fixture;

    const row = shell.component.rows()[0];
    expect(row.protein).toBe('—');
    expect(row.carbs).toBe('—');
    expect(row.over.protein).toBe(false);
  });

  it('hints at the last entry of the day', () => {
    const shell = setup();
    fixture = shell.fixture;

    expect(text(shell.el, 'hint-text')).toBe('Nothing logged since 12:00.');
  });

  it('hints at an empty day', () => {
    const shell = setup([]);
    fixture = shell.fixture;

    expect(shell.component.markers()).toEqual([]);
    expect(shell.component.rows()).toEqual([]);
    expect(shell.component.hint()).toBe('Nothing logged yet.');
    expect(text(shell.el, 'hint-text')).toBe('Nothing logged yet.');
  });
});
