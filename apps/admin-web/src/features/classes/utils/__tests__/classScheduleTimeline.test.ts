import type { StoredClassSchedule } from '../../types/schedule';
import { partitionClassScheduleTimeline } from '../classScheduleTimeline';

function revision(
  id: string,
  effectiveFrom: string,
  effectiveTo: string
): StoredClassSchedule {
  return {
    id,
    scheduleType: 'RECURRING',
    sessionType: 'CLASS',
    billingType: 'CLASS',
    frequencyWeeks: 1,
    anchorDate: effectiveFrom,
    effectiveFrom,
    effectiveTo,
    rows: [],
  };
}

describe('Class schedule timeline', () => {
  it('derives current and upcoming configurations from the requested date', () => {
    const timeline = [
      revision('current', '2026-01-01', '2026-09-09'),
      revision('upcoming', '2026-09-10', '2026-12-31'),
    ];

    expect(partitionClassScheduleTimeline(timeline, '2026-09-03')).toEqual({
      current: timeline[0],
      upcoming: [timeline[1]],
    });
  });

  it('rolls the upcoming configuration into current after its effective date', () => {
    const timeline = [
      revision('expired', '2026-01-01', '2026-09-09'),
      revision('current', '2026-09-10', '2026-12-31'),
    ];

    expect(partitionClassScheduleTimeline(timeline, '2026-09-10')).toEqual({
      current: timeline[1],
      upcoming: [],
    });
  });
});
