import {
  buildAdminShiftScheduleProposal,
  partitionAdminShiftScheduleTimeline,
  resolveAdminShiftEffectiveFrom,
  validateAdminShiftSchedule,
} from '../adminShiftSchedule';
import type { StoredAdminShiftSchedule } from '../../types/schedule';

function revision(
  id: string,
  effectiveFrom: string,
  effectiveTo: string
): StoredAdminShiftSchedule {
  return {
    id,
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '10:00',
    status: 'ACTIVE',
    effectiveFrom,
    effectiveTo,
  };
}

describe('Admin shift schedule timeline', () => {
  it('keeps the timetable before the effective date and shows the later one as upcoming', () => {
    const timeline = [
      revision('current', '2026-01-01', '2026-11-17'),
      revision('upcoming', '2026-11-18', '2026-12-31'),
    ];

    expect(partitionAdminShiftScheduleTimeline(timeline, '2026-11-04')).toEqual({
      current: timeline[0],
      upcoming: [timeline[1]],
    });
  });

  it('treats the later timetable as current once its effective date arrives', () => {
    const timeline = [
      revision('previous', '2026-01-01', '2026-11-17'),
      revision('current', '2026-11-18', '2026-12-31'),
    ];

    expect(partitionAdminShiftScheduleTimeline(timeline, '2026-11-18').current).toBe(timeline[1]);
  });

  it('starts a change today when the current timetable is already in force', () => {
    expect(resolveAdminShiftEffectiveFrom('2026-01-01', '2026-01-01', '2026-11-04')).toBe('2026-11-04');
  });

  it('keeps a future effective date when that change has not started', () => {
    expect(resolveAdminShiftEffectiveFrom('2026-01-01', '2026-12-01', '2026-11-04')).toBe('2026-12-01');
  });

  it('rejects an effective date before today', () => {
    expect(validateAdminShiftSchedule({
      startTime: '09:00',
      endTime: '10:00',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      effectiveFrom: '2026-11-03',
      today: '2026-11-04',
    })).toBe('The effective date must be today or later and inside the shift dates.');
  });

  it('builds the effective-dated proposal from the edited timetable', () => {
    expect(buildAdminShiftScheduleProposal({
      adminShiftId: 'shift-1',
      dayOfWeek: 2,
      startTime: '10:00:00',
      endTime: '11:00',
      status: 'ACTIVE',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      effectiveFrom: '2026-11-18',
    })).toEqual({
      admin_shift_id: 'shift-1',
      day_of_week: 2,
      start_time: '10:00',
      end_time: '11:00',
      status: 'ACTIVE',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      effective_from: '2026-11-18',
      timezone: 'Australia/Adelaide',
    });
  });
});
