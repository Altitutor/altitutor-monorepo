/** @jest-environment node */
import { randomUUID } from 'node:crypto';
import * as Sentry from '@sentry/nextjs';
import type { InterviewMediaEvidence } from '@altitutor/shared/interviews/server';
import { withInterviewMediaEvidence } from '../media-evidence';

jest.mock('node:crypto', () => ({ randomUUID: jest.fn() }));
jest.mock('@sentry/nextjs', () => ({ withIsolationScope: jest.fn() }));

const uuid = jest.mocked(randomUUID);
type CallbackIsolation = <T>(callback: (scope: Sentry.Scope) => T) => T;
const isolate = jest.mocked(Sentry.withIsolationScope as CallbackIsolation);
const scope = { setContext: jest.fn() } as unknown as Sentry.Scope;

beforeEach(() => {
  jest.resetAllMocks();
  uuid.mockReturnValue('10000000-0000-4000-8000-000000000001');
  isolate.mockImplementation((callback) => callback(scope));
});

it.each(['uuid', 'scope'])('runs the original action once when %s setup fails', async (failure) => {
  const setupError = new Error('diagnostic setup unavailable');
  if (failure === 'uuid') uuid.mockImplementation(() => { throw setupError; });
  else isolate.mockImplementation(() => { throw setupError; });
  const response = Response.json({ error: 'Round access denied' }, { status: 403 });
  const action = jest.fn(async () => response);
  expect(await withInterviewMediaEvidence(action)).toBe(response);
  expect(action).toHaveBeenCalledTimes(1);
});

it('preserves an action rejection without replaying it', async () => {
  const failure = new Error('real operation failed');
  const action = jest.fn(async () => { throw failure; });
  await expect(withInterviewMediaEvidence(action)).rejects.toBe(failure);
  expect(action).toHaveBeenCalledTimes(1);
});

it('preserves a synchronous action error without treating it as setup failure', () => {
  const failure = new Error('real operation failed synchronously');
  const action = jest.fn((): Promise<Response> => { throw failure; });
  expect(() => withInterviewMediaEvidence(action)).toThrow(failure);
  expect(action).toHaveBeenCalledTimes(1);
});

it('preserves the already started action when the scope wrapper subsequently throws', async () => {
  isolate.mockImplementation((callback) => {
    callback(scope);
    throw new Error('diagnostic scope cleanup failed');
  });
  const response = Response.json({ captureId: 'capture' });
  const action = jest.fn(async () => response);
  expect(await withInterviewMediaEvidence(action)).toBe(response);
  expect(action).toHaveBeenCalledTimes(1);
});

it('keeps evidence publication failures from changing the action result', async () => {
  jest.mocked(scope.setContext).mockImplementation(() => { throw new Error('collector unavailable'); });
  const response = Response.json({ error: 'Round access denied' }, { status: 403 });
  const action = jest.fn(async (diagnostic: (evidence: InterviewMediaEvidence) => void) => {
    diagnostic({ version: 1, operation: 'resolve_actor', roundId: '10000000-0000-4000-8000-000000000001', role: 'tutor', captureRequested: false });
    return response;
  });
  expect(await withInterviewMediaEvidence(action)).toBe(response);
  expect(action).toHaveBeenCalledTimes(1);
});

it.each([
  ['syd1::iad1::abcde-1794742000000-abcdef123456', 'syd1::iad1::abcde-1794742000000-abcdef123456'],
  ['Bearer secret', undefined],
  ['syd1::abcde-1794742000000-abcdef123456,secret', undefined],
])('copies only the validated invocation ID from the request (%s)', async (incoming, expected) => {
  const request = new Request('http://localhost/media?accessKey=never-copy', { headers: { 'x-vercel-id': incoming, authorization: 'Bearer never-copy' } });
  await withInterviewMediaEvidence(async (diagnostic) => {
    diagnostic({ version: 1, operation: 'resolve_actor', roundId: '10000000-0000-4000-8000-000000000001', role: 'tutor', captureRequested: false });
  }, request);
  const context = jest.mocked(scope.setContext).mock.calls[0]?.[1] as { vercelId?: string };
  expect(context.vercelId).toBe(expected);
  expect(JSON.stringify(context)).not.toMatch(/never-copy|Bearer secret|,secret/);
});
