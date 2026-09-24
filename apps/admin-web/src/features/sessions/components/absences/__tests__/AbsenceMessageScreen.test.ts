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
      'queued',
    );

    expect(details).toContain('billing credit is being processed');
    expect(details).not.toContain('credit has been applied');
    expect(details).not.toContain('account');
  });

  it('describes a completed credit without promising an account balance', () => {
    const details = buildAbsenceDetails(
      [creditDecision],
      [session],
      new Map(),
      'processed',
    );

    expect(details).toContain('this session has been credited');
    expect(details).not.toContain('account');
  });
});
