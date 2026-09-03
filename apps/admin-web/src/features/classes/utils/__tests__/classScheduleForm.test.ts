import {
  buildClassScheduleProposal,
  resolveClassScheduleRows,
  validateClassScheduleRows,
} from '../classScheduleForm';

const tuesday = {
  id: '10000000-0000-0000-0000-000000000001',
  dayOfWeek: 2,
  startTime: '13:00',
  endTime: '14:00',
  room: ' Room 1 ',
};

describe('Class schedule form', () => {
  it('requires at least one non-overlapping schedule row', () => {
    expect(validateClassScheduleRows([])).toBe('Add at least one schedule row.');
    expect(
      validateClassScheduleRows([
        tuesday,
        { ...tuesday, id: '10000000-0000-0000-0000-000000000002', startTime: '13:30' },
      ])
    ).toBe('Schedule rows on the same day cannot overlap.');
  });

  it('builds the bounded Adelaide weekly planner proposal with separate rows', () => {
    expect(
      buildClassScheduleProposal({
        classId: '90000000-0000-0000-0000-000000000001',
        subjectId: null,
        billingType: 'EXAM_COURSE',
        cohortLabel: ' Interview A ',
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        frequencyWeeks: 1,
        rows: [tuesday, { ...tuesday, id: '10000000-0000-0000-0000-000000000003', dayOfWeek: 3 }],
      })
    ).toMatchObject({
      cohort_label: 'Interview A',
      billing_type: 'EXAM_COURSE',
      schedule_type: 'RECURRING',
      timezone: 'Australia/Adelaide',
      anchor_date: '2026-09-01',
      recurring_rows: [
        { day_of_week: 2, start_time: '13:00', end_time: '14:00', room: 'Room 1', position: 0 },
        { day_of_week: 3, position: 1 },
      ],
    });
  });

  it('falls back to the legacy Class schedule when no revision exists', () => {
    expect(
      resolveClassScheduleRows(null, {
        dayOfWeek: 1,
        startTime: '16:00:00',
        endTime: '17:30:00',
        room: null,
      }, () => 'legacy-row')
    ).toEqual([{
      id: 'legacy-row',
      dayOfWeek: 1,
      startTime: '16:00:00',
      endTime: '17:30:00',
      room: '',
    }]);
  });
});
