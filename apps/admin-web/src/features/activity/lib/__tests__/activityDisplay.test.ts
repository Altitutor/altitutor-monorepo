import { getActivityDisplaySnapshot, eventHasDisplaySnapshot } from '../activityDisplay';
import type { ActivityEvent } from '../../types';

type ActivityEventMetadata = Pick<ActivityEvent, 'metadata'>;

describe('activityDisplay', () => {
  it('reads non-empty display strings from metadata', () => {
    const event: ActivityEventMetadata = {
      metadata: {
        display: {
          student_name: 'Jane Doe',
          performed_by_name: '  ',
          class_name: 'Y11 Chem',
        },
      },
    };

    expect(getActivityDisplaySnapshot(event)).toEqual({
      student_name: 'Jane Doe',
      class_name: 'Y11 Chem',
    });
    expect(eventHasDisplaySnapshot(event)).toBe(true);
  });

  it('returns null when display is missing or empty', () => {
    const missingDisplay: ActivityEventMetadata = { metadata: null };
    const emptyDisplay: ActivityEventMetadata = { metadata: { display: {} } };

    expect(eventHasDisplaySnapshot(missingDisplay)).toBe(false);
    expect(eventHasDisplaySnapshot(emptyDisplay)).toBe(false);
  });
});
