import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tables } from '@altitutor/shared';
import type { StoredClassSchedule } from '../../../../types/schedule';
import { ClassInfoTab } from '../ClassInfoTab';

jest.mock('@/features/billing', () => ({
  useBillingPricing: () => ({ data: [], isLoading: false }),
  useSubjectPricingOverrides: () => ({ data: [], isLoading: false }),
}));

const previewSchedule = jest.fn();
const mockScheduleTimeline = jest.fn();

jest.mock('../../../../hooks/useClassesQuery', () => ({
  useClassScheduleTimeline: () => mockScheduleTimeline(),
  usePreviewClassSchedule: () => ({ mutateAsync: previewSchedule, isPending: false }),
  useApplyClassSchedule: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

const biology = {
  id: 'subject-biology',
  long_name: 'Biology',
  color: null,
} as Tables<'subjects'>;

const endedClass = {
  id: 'class-ended',
  subject_id: biology.id,
  session_type: 'CLASS',
  billing_type: 'CLASS',
  cohort_label: 'Exam Course',
  level: 'Exam Course',
  status: 'ACTIVE',
  session_start_date: '2026-09-16',
  session_end_date: '2026-11-06',
  day_of_week: 3,
  start_time: '16:15:00',
  end_time: '19:15:00',
  room: 'A',
} as Tables<'classes'>;

const endedRevision: StoredClassSchedule = {
  id: 'revision-ended',
  scheduleType: 'RECURRING',
  sessionType: 'CLASS',
  billingType: 'CLASS',
  frequencyWeeks: 1,
  anchorDate: '2026-09-16',
  effectiveFrom: '2026-09-16',
  effectiveTo: '2026-10-28',
  rows: [{
    id: 'slot-wednesday',
    dayOfWeek: 3,
    startTime: '16:15:00',
    endTime: '19:15:00',
    room: 'A',
  }],
};

function renderTab(isEditing: boolean) {
  return render(
    <ClassInfoTab
      classData={endedClass}
      subject={biology}
      subjects={[biology]}
      isEditing={isEditing}
      isLoading={false}
      onEdit={jest.fn()}
      onCancelEdit={jest.fn()}
      onSaved={jest.fn()}
    />
  );
}

describe('ClassInfoTab ended schedule', () => {
  beforeAll(() => {
    if (!globalThis.crypto.randomUUID) {
      Object.defineProperty(globalThis.crypto, 'randomUUID', {
        value: () => '11111111-1111-4111-8111-111111111111',
      });
    }
  });

  beforeEach(() => {
    previewSchedule.mockReset();
    previewSchedule.mockResolvedValue({
      proposal_hash: 'hash',
      counts: { create: 1, cancel: 0, protected: 0, preserve: 0 },
      conflicts: [],
      occurrences: [],
      removals: [],
    });
    mockScheduleTimeline.mockReturnValue({ data: [], isLoading: false });
  });

  it('keeps the last timetable and subject when no revision is still in force', async () => {
    const user = userEvent.setup();
    renderTab(true);

    expect(screen.getByText('Wednesday')).toBeInTheDocument();
    expect(screen.getByDisplayValue('16:15:00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('19:15:00')).toBeInTheDocument();
    expect(screen.getByText('Biology')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Review changes' }));

    expect(previewSchedule).toHaveBeenCalledWith(expect.objectContaining({
      class_id: endedClass.id,
      subject_id: biology.id,
      end_date: '2026-11-06',
      recurring_rows: [
        expect.objectContaining({
          day_of_week: 3,
          start_time: '16:15:00',
          end_time: '19:15:00',
          room: 'A',
        }),
      ],
    }));
  });

  it('shows the ended timetable instead of an empty schedule', () => {
    mockScheduleTimeline.mockReturnValue({ data: [endedRevision], isLoading: false });
    renderTab(false);

    expect(screen.getByText(/Wednesday 4:15 PM–7:15 PM/)).toBeInTheDocument();
    expect(screen.queryByText('No active or upcoming schedule is configured.')).not.toBeInTheDocument();
  });
});
