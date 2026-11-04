import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tables } from '@altitutor/shared';
import type { StoredAdminShiftSchedule } from '../../../../types/schedule';
import { AdminShiftInfoTab } from '../AdminShiftInfoTab';

const mockPreviewSchedule = jest.fn();

const mockSchedule = [
  {
    id: 'current',
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '10:00',
    status: 'ACTIVE',
    effectiveFrom: '2020-01-01',
    effectiveTo: '2099-01-01',
  },
  {
    id: 'upcoming',
    dayOfWeek: 2,
    startTime: '10:00',
    endTime: '11:00',
    status: 'ACTIVE',
    effectiveFrom: '2099-06-01',
    effectiveTo: '2099-12-31',
  },
] satisfies StoredAdminShiftSchedule[];

jest.mock('../../../../hooks/useAdminShiftsQuery', () => ({
  useAdminShiftSchedule: () => ({
    data: mockSchedule,
    isLoading: false,
  }),
  usePreviewAdminShiftSchedule: () => ({ mutateAsync: mockPreviewSchedule, isPending: false }),
  useApplyAdminShiftSchedule: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

const adminShift = {
  id: 'shift-1',
  day_of_week: 1,
  start_time: '09:00',
  end_time: '10:00',
  status: 'ACTIVE',
  session_start_date: '2020-01-01',
  session_end_date: '2099-12-31',
  created_at: '2020-01-01T00:00:00Z',
  created_by: null,
  updated_at: '2020-01-01T00:00:00Z',
  deleted_at: null,
  deleted_by: null,
} as Tables<'admin_shifts'>;

describe('AdminShiftInfoTab', () => {
  beforeEach(() => {
    mockPreviewSchedule.mockReset();
    mockPreviewSchedule.mockResolvedValue({
      proposal_hash: 'hash',
      counts: { create: 1, cancel: 0, preserve: 0, protected: 0 },
      occurrences: [{
        start_at: '2099-06-01T00:30:00.000Z',
        end_at: '2099-06-01T01:30:00.000Z',
        action: 'CREATE',
      }],
      removals: [],
      conflicts: [],
    });
  });

  it('shows the current timetable and the later effective date', () => {
    render(
      <AdminShiftInfoTab
        adminShiftData={adminShift}
        isEditing={false}
        isLoading={false}
        onEdit={jest.fn()}
        onCancelEdit={jest.fn()}
        onSaved={jest.fn()}
      />
    );

    expect(screen.getByText('Current schedule')).toBeInTheDocument();
    expect(screen.getByText('From Jun 1, 2099')).toBeInTheDocument();
    expect(screen.getByText('Monday 9:00 AM–10:00 AM')).toBeInTheDocument();
    expect(screen.getByText('Tuesday 10:00 AM–11:00 AM')).toBeInTheDocument();
  });

  it('previews a change from the selected effective date', async () => {
    const user = userEvent.setup();
    render(
      <>
        <AdminShiftInfoTab
          adminShiftData={adminShift}
          isEditing
          isLoading={false}
          onEdit={jest.fn()}
          onCancelEdit={jest.fn()}
          onSaved={jest.fn()}
        />
        <button type="submit" form="admin-shift-edit-form">Review changes</button>
      </>
    );

    await user.click(screen.getByRole('button', { name: 'Review changes' }));

    await waitFor(() => expect(mockPreviewSchedule).toHaveBeenCalledWith(expect.objectContaining({
      admin_shift_id: 'shift-1',
      day_of_week: 2,
      start_time: '10:00',
      end_time: '11:00',
      effective_from: '2099-06-01',
      start_date: '2020-01-01',
      end_date: '2099-12-31',
    })));
    expect(screen.getByText('Tuesday 10:00 AM–11:00 AM')).toBeInTheDocument();
    expect(screen.getByText('Sessions from this date')).toBeInTheDocument();
    expect(screen.getByText('Mon, 1 June 2099, 10:00 am')).toBeInTheDocument();
  });
});
