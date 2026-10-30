import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiService } from './api.service';
import { DayResponse } from './models';

const DAY: DayResponse = {
  date: '2026-10-30',
  timezone: 'Europe/Vienna',
  goals: { kcal: 2000, protein_g: 130, carbs_g: 210, fat_g: 70, water_ml: 3000 },
  totals: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, water_ml: 0 },
  entries: [],
};

describe('ApiService', () => {
  let api: ApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests today under /api/today', () => {
    let received: DayResponse | undefined;
    api.getToday().subscribe((day) => (received = day));

    http.expectOne({ method: 'GET', url: '/api/today' }).flush(DAY);

    expect(received).toEqual(DAY);
  });
});
