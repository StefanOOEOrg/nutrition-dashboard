import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { DayResponse } from './models';

/**
 * Thin wrapper around the server's REST API (relative URLs, the server serves the UI as well).
 * Builds the request and returns the observable - no error handling, no state: the shell does
 * that.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  /** `GET /api/today` - the numbers of the current day in the configured time zone. */
  getToday(): Observable<DayResponse> {
    return this.http.get<DayResponse>('/api/today');
  }
}
