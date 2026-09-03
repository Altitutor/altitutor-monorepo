import { resourceMetricKey } from '@altitutor/shared/pay-tiers';
import {
  buildMetricOverridesFromUi,
  resourceOverridesToRows,
  sessionOverridesToRows,
  timeOverridesToRows,
} from '../metricOverrides';

describe('pay-tier metric overrides', () => {
  it('round-trips session, time, and subject-aware resource leaves', () => {
    const original = {
      'sessions.CLASS.MAIN_TUTOR': 12,
      'sessions.HOMEWORK_HELP.any': 4,
      'tenure.days': 30,
      [resourceMetricKey('NOTES', 'subject-a')]: 5,
      [resourceMetricKey('UNKNOWN')]: 2,
    };

    expect(
      buildMetricOverridesFromUi(
        sessionOverridesToRows(original),
        timeOverridesToRows(original),
        resourceOverridesToRows(original)
      )
    ).toEqual(original);
  });
});
