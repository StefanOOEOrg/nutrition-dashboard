import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { App, errorMessage } from './app';
import { ApiService } from './api.service';
import { BudgetPanel } from './budget-panel/budget-panel';
import { DayLog } from './day-log/day-log';
import { DayResponse, Entry, Goals, Totals } from './models';

const DAY: DayResponse = {
  date: '2026-10-30',
  timezone: 'Europe/Vienna',
  goals: { kcal: 2000, protein_g: 130, carbs_g: 210, fat_g: 70, water_ml: 3000 },
  totals: { kcal: 554, protein_g: 49.3, carbs_g: 58.2, fat_g: 12.9, water_ml: 0 },
  entries: [
    {
      time: '07:30',
      kind: 'meal',
      meal_types: ['breakfast'],
      foods: ['Kaffee mit Milch 1 Tasse'],
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
  ],
};

/** Stand-in for the budget column: the shell spec only checks what it passes down. */
@Component({
  selector: 'app-budget-panel',
  template: '<span data-testid="stub-budget">{{ entryCount }}</span>',
})
class BudgetPanelStub {
  @Input() goals: Goals | null = null;
  @Input() totals: Totals | null = null;
  @Input() entryCount: number | null = null;
}

/** Stand-in for the log column. */
@Component({
  selector: 'app-day-log',
  template: '<span data-testid="stub-log">{{ nowLabel }}</span>',
})
class DayLogStub {
  @Input() entries: Entry[] = [];
  @Input() goals: Goals | null = null;
  @Input() nowLabel = '';
}

function setup(getToday: () => Observable<DayResponse>): ComponentFixture<App> {
  TestBed.configureTestingModule({
    providers: [{ provide: ApiService, useValue: { getToday } }],
  });
  TestBed.overrideComponent(App, {
    remove: { imports: [BudgetPanel, DayLog] },
    add: { imports: [BudgetPanelStub, DayLogStub] },
  });
  return TestBed.createComponent(App);
}

function text(fixture: ComponentFixture<App>, testId: string): string {
  const element = fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as HTMLElement;
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('App', () => {
  let fixture: ComponentFixture<App> | null = null;

  afterEach(() => {
    fixture?.destroy();
    fixture = null;
  });

  it('loads the day on start and passes it to both columns', () => {
    fixture = setup(() => of(DAY));
    fixture.detectChanges();

    expect(text(fixture, 'date')).toBe('Friday, 30 October 2026');
    expect(text(fixture, 'updated')).toMatch(/^updated \d{2}:\d{2}$/);
    expect(text(fixture, 'stub-budget')).toBe('2');
    expect(text(fixture, 'stub-log')).toMatch(/^\d{2}:\d{2}$/);
  });

  it('shows the message of a failed load and keeps the page usable', () => {
    fixture = setup(() =>
      throwError(
        () =>
          new HttpErrorResponse({
            status: 500,
            error: { detail: 'Could not read the diary: connection refused' },
          }),
      ),
    );
    fixture.detectChanges();

    expect(text(fixture, 'error')).toContain('Could not read the diary: connection refused');
    expect(text(fixture, 'placeholder')).toBe('Nothing loaded yet.');
  });

  it('dismisses the error bar', () => {
    fixture = setup(() => throwError(() => new HttpErrorResponse({ status: 500, error: {} })));
    fixture.detectChanges();

    const dismiss = fixture.nativeElement.querySelector(
      '[data-testid="error"] button',
    ) as HTMLButtonElement;
    dismiss.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="error"]')).toBeNull();
  });

  it('reloads on Refresh', () => {
    let calls = 0;
    fixture = setup(() => {
      calls += 1;
      return of(DAY);
    });
    fixture.detectChanges();
    expect(calls).toBe(1);

    (fixture.nativeElement.querySelector('[data-testid="refresh"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(calls).toBe(2);
  });
});

describe('errorMessage', () => {
  it('prefers the server detail', () => {
    const error = new HttpErrorResponse({ status: 500, error: { detail: 'boom' } });
    expect(errorMessage(error)).toBe('boom');
  });

  it('falls back to the transport message', () => {
    expect(errorMessage(new Error('Http failure response'))).toBe('Http failure response');
  });

  it('has a generic sentence for everything else', () => {
    expect(errorMessage(42)).toBe('Could not load the day.');
    expect(errorMessage(new HttpErrorResponse({ status: 500, error: { detail: '  ' } }))).toBe(
      'Could not load the day.',
    );
  });
});
