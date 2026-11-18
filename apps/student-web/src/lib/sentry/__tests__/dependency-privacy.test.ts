/** @jest-environment node */
import * as Sentry from '@sentry/nextjs';
import { createDependencyEvidence } from '@altitutor/shared';
jest.mock('@sentry/nextjs', () => ({ init: jest.fn() }));

test.each(['../../../sentry.server.config', '../../../sentry.edge.config'])('%s runs final dependency privacy after SDK enrichment', async (path) => {
  jest.mocked(Sentry.init).mockClear();
  await import(path);
  const beforeSend = jest.mocked(Sentry.init).mock.calls[0]?.[0]?.beforeSend;
  const event: Sentry.ErrorEvent = {
    type: undefined,
    message: 'Middleware dependency unavailable', tags: { app: 'student-web', dependency_stage: 'authentication' },
    request: { url: 'https://student.test/dashboard?email=private-url', headers: { cookie: 'private-cookie' } },
    user: { email: 'private-email@example.test' }, breadcrumbs: [{ message: 'private-breadcrumb' }],
    extra: { dependency_evidence: createDependencyEvidence({}).snapshot(), inherited: 'private-extra' },
  };
  const safe = beforeSend?.(event, {});
  expect(safe).toMatchObject({ message: 'Middleware dependency unavailable', extra: { dependency_evidence: { version: 1 } } });
  expect(JSON.stringify(safe)).not.toMatch(/private-|example.test/);
});
