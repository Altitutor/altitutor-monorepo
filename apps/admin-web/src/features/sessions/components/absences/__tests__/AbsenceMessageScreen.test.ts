import { buildAbsenceDetails } from '../AbsenceMessageScreen';
import type { AbsenceDecision, StudentSession } from '../../../types/absence';

describe('buildAbsenceDetails', () => {
  const creditDecision: AbsenceDecision = {
    sessionId: 'session-1',
    sessionsStudentsId: 'assignment-1',
    action: 'credit',
  };
  const session = {
    id: 'session-1',
    start_at: '2026-09-09T06:30:00.000Z',
    subject: { short_name: 'Maths' },
  } as StudentSession;

  it('does not tell the customer a queued credit has already been applied', () => {
    const details = buildAbsenceDetails(
      [creditDecision],
      [session],
      new Map(),
      true,
    );

    expect(details).toContain('credit is being processed');
    expect(details).not.toContain('credit has been applied');
  });

  it('describes a successfully processed credit as applied', () => {
    const details = buildAbsenceDetails(
      [creditDecision],
      [session],
      new Map(),
      false,
    );

    expect(details).toContain('credit has been applied');
  });
});
