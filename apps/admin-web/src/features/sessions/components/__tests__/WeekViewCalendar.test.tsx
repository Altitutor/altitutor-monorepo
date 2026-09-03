import React from 'react';
import { screen } from '@testing-library/react';
import { WeekViewCalendar } from '../WeekViewCalendar';
import { renderWithProviders } from '@/shared/test-utils';
import type { Tables } from '@altitutor/shared';

beforeAll(() => {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    value: class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    writable: true,
  });
});

describe('WeekViewCalendar', () => {
  it('shows the replacement session name on calendar cards', () => {
    const weekStart = new Date(2026, 8, 7, 0, 0, 0, 0);
    const sessionStart = new Date(2026, 8, 8, 16, 15, 0, 0);
    const sessionEnd = new Date(2026, 8, 8, 17, 45, 0, 0);

    renderWithProviders(
      <WeekViewCalendar
        sessions={[
          {
            id: 'session-2',
            start_at: sessionStart.toISOString(),
            end_at: sessionEnd.toISOString(),
            class_id: 'class-2',
            type: 'CLASS',
            short_name: '12MATH tue 8 Sep 4:15',
            long_name: 'SACE 12 Mathematical Methods Tuesday 8th Sep 2026 4:15 pm - 5:45 pm',
            class: { short_name: '12MATH tue 4:15' } as Tables<'classes'>,
            subject: {
              short_name: '12MATH',
              long_name: 'SACE 12 Mathematical Methods',
              name: 'Mathematical Methods',
            } as Tables<'subjects'>,
          },
        ]}
        selectedSessionIds={new Set()}
        onToggleSession={jest.fn()}
        currentWeekStart={weekStart}
        onWeekChange={jest.fn()}
      />
    );

    expect(screen.getByText('12MATH tue 8 Sep 4:15')).toBeInTheDocument();
  });

  it('falls back to subject name when generated session names are missing', () => {
    const weekStart = new Date(2026, 8, 7, 0, 0, 0, 0);
    const sessionStart = new Date(2026, 8, 8, 16, 15, 0, 0);
    const sessionEnd = new Date(2026, 8, 8, 17, 45, 0, 0);

    renderWithProviders(
      <WeekViewCalendar
        sessions={[
          {
            id: 'session-2',
            start_at: sessionStart.toISOString(),
            end_at: sessionEnd.toISOString(),
            class_id: 'class-2',
            type: 'CLASS',
            class: {} as Tables<'classes'>,
            subject: {
              name: 'Mathematical Methods',
            } as Tables<'subjects'>,
          },
        ]}
        selectedSessionIds={new Set()}
        onToggleSession={jest.fn()}
        currentWeekStart={weekStart}
        onWeekChange={jest.fn()}
      />
    );

    expect(screen.getByText('Mathematical Methods')).toBeInTheDocument();
  });
});
