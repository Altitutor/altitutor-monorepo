import type { InterviewCallFailure } from '@altitutor/shared';
const mockCapture = jest.fn();
jest.mock('@sentry/nextjs', () => ({ captureEvent: (...args: unknown[]) => mockCapture(...args) }));

const failure: InterviewCallFailure = { source: 'sdk', category: 'connection', phase: 'questions', state: 'joined' };
async function reporter() {
  let report: (failure: InterviewCallFailure) => void = () => undefined;
  await jest.isolateModulesAsync(async () => { report = (await import('../interview-call-reporting')).reportInterviewCallFailure; });
  return report;
}
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); mockCapture.mockReset(); });

it('captures a bounded failure category without forwarding extra SDK fields', async () => {
  const report = await reporter();
  report({ ...failure, rawMessage: 'private provider detail', userId: 'private student' } as InterviewCallFailure);
  expect(mockCapture).toHaveBeenCalledWith(expect.objectContaining({ message: 'Interview call failed', tags: {
    app: 'tutor-web', 'interview.failure': 'true', 'interview.source': 'sdk', 'interview.category': 'connection', 'interview.phase': 'questions', 'interview.state': 'joined',
  } }));
  expect(JSON.stringify(mockCapture.mock.calls)).not.toContain('private');
});

it('deduplicates reconnect storms and bounds repeated failures per browser tab', async () => {
  jest.useFakeTimers(); jest.setSystemTime(new Date('2026-10-28T12:00:00Z'));
  const report = await reporter();
  for (let n = 0; n < 1000; n++) report(failure);
  expect(mockCapture).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(60_000); report(failure);
  jest.advanceTimersByTime(60_000); report(failure);
  jest.advanceTimersByTime(60_000); report(failure);
  expect(mockCapture).toHaveBeenCalledTimes(3);
  jest.advanceTimersByTime(120_000); report(failure);
  expect(mockCapture).toHaveBeenCalledTimes(4);
});

it('does not throw into the call if the monitoring SDK is unavailable', async () => {
  mockCapture.mockImplementation(() => { throw new Error('SDK unavailable'); });
  const report = await reporter();
  expect(() => report(failure)).not.toThrow();
});
