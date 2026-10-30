import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { ApiService } from './api.service';
import { BudgetPanel } from './budget-panel/budget-panel';
import { DayLog } from './day-log/day-log';
import { clockLabel, dateLabel } from './format';
import { DayResponse } from './models';

/**
 * Readable message for a failed load: the server's `detail` when there is one, otherwise the
 * transport message, otherwise a generic sentence.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const detail = (error.error as { detail?: unknown } | null)?.detail;
    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return 'Could not load the day.';
}

/**
 * Shell: header, error bar, and the two columns (budget left, day log right).
 *
 * The page never scrolls; each column scrolls on its own. Data comes from `GET /api/today` on
 * start and on every `Refresh` click.
 */
@Component({
  selector: 'app-root',
  imports: [BudgetPanel, DayLog],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private readonly api = inject(ApiService);
  /** Last successful response; `null` until the first load. */
  protected readonly day = signal<DayResponse | null>(null);
  /** Readable message of the last failed load. */
  protected readonly error = signal<string | null>(null);
  /** `true` while a request is in flight. */
  protected readonly loading = signal(false);
  /** Wall-clock time of the last load, `HH:MM`. */
  protected readonly nowLabel = signal(clockLabel(new Date()));
  /** Number of logged entries today, `0` before the first load. */
  protected readonly entryCount = computed(() => this.day()?.entries.length ?? 0);
  /** Long date of the loaded day, empty before the first load. */
  protected readonly dateText = computed(() => {
    const day = this.day();
    return day ? dateLabel(day.date) : '';
  });

  ngOnInit(): void {
    this.load();
  }

  /** Load today: on success replace the data, on failure keep it and show the message. */
  protected load(): void {
    this.loading.set(true);
    this.api.getToday().subscribe({
      next: (day) => {
        this.day.set(day);
        this.error.set(null);
        this.nowLabel.set(clockLabel(new Date()));
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(errorMessage(error));
        this.loading.set(false);
      },
    });
  }

  protected dismissError(): void {
    this.error.set(null);
  }
}
