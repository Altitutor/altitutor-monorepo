import { createSubjectCoverObserver, sanitizeSubjectCoverEvent } from '../subject-cover-diagnostics';

const { webcrypto } = jest.requireActual<{ webcrypto: Crypto }>('node:crypto');
const path = 'subject/_subject_image/123_private-student-name.png';
async function waitForCaptures(capture: { mock: { calls: unknown[][] } }, count: number) {
  const deadline = Date.now() + 5_000;
  while (capture.mock.calls.length < count && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  expect(capture.mock.calls).toHaveLength(count);
}
beforeAll(() => { Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto }); });

it('correlates writer and signing outcomes without retaining the key or raw provider error', async () => {
  const capture = jest.fn();
  const write = createSubjectCoverObserver('admin-web', capture);
  const read = createSubjectCoverObserver('student-web', capture);
  const result = { data: { signedUrl: 'https://private.invalid?token=secret' }, error: { code: 'NoSuchKey', message: path } };
  await write('resources', path, 'upload', async () => ({ error: null }));
  expect(await read('resources', path, 'sign', async () => result)).toBe(result);
  await waitForCaptures(capture, 2);
  const events = capture.mock.calls.map(([event]) => event);
  const writer = events.find((event) => event.contexts.subject_cover.operation === 'upload');
  const reader = events.find((event) => event.contexts.subject_cover.operation === 'sign');
  expect(writer.contexts.subject_cover.object_hash).toMatch(/^[a-f0-9]{64}$/);
  expect(reader.contexts.subject_cover.object_hash).toBe(writer.contexts.subject_cover.object_hash);
  expect(reader.contexts.subject_cover).toMatchObject({ operation: 'sign', outcome: 'error', code: 'NoSuchKey' });
  expect(JSON.stringify(capture.mock.calls)).not.toMatch(/private-student|token=|private.invalid|_subject_image/);
});

it('preserves thrown errors and remains harmless when reporting throws', async () => {
  const capture = jest.fn((_event: unknown) => { throw new Error('telemetry failed'); });
  const observe = createSubjectCoverObserver('admin-web', capture);
  const failure = new Error('provider message with secret');
  await expect(observe('resources', path, 'delete', async () => { throw failure; })).rejects.toBe(failure);
  await waitForCaptures(capture, 1);
  expect(capture.mock.calls[0][0]).toMatchObject({ contexts: { subject_cover: { operation: 'delete', outcome: 'threw', code: 'unknown' } } });
});

it('ignores ordinary successful signing and unrelated files; bounds burst volume', async () => {
  const capture = jest.fn();
  const observe = createSubjectCoverObserver('tutor-web', capture);
  await observe('resources', path, 'sign', async () => ({ error: null }));
  await observe('resources', 'subject/topic/private.pdf', 'delete', async () => ({ error: null }));
  await observe('staff-files', path, 'delete', async () => ({ error: null }));
  expect(capture).not.toHaveBeenCalled();
  await Promise.all(Array.from({ length: 120 }, () => observe('resources', path, 'sign', async () => ({ error: { code: 'NoSuchKey' } }))));
  await waitForCaptures(capture, 100);
});

it('strips SDK enrichment and rejects malformed diagnostics at final beforeSend', () => {
  const event = {
    event_id: 'event', release: 'release', timestamp: 123,
    tags: { 'subject_cover.diagnostic': 'true', app: 'student-web', private: 'secret' },
    contexts: { subject_cover: { operation: 'sign', outcome: 'error', object_hash: 'a'.repeat(64), duration_ms: 20, started_at_ms: 123, code: 'NoSuchKey', private: 'secret' }, private: 'secret' },
    user: { email: 'private@example.invalid' }, request: { url: 'https://private.invalid' }, breadcrumbs: ['secret'], extra: { secret: true },
  };
  const safe = sanitizeSubjectCoverEvent(event);
  expect(JSON.stringify(safe)).not.toMatch(/secret|private|breadcrumbs|request|email/);
  expect(safe).toMatchObject({ release: 'release', timestamp: 123, contexts: { subject_cover: { code: 'NoSuchKey' } } });
  expect(sanitizeSubjectCoverEvent({ ...event, contexts: { subject_cover: { ...event.contexts.subject_cover, object_hash: path } } })).toBeNull();
  const ordinary = { tags: { app: 'student-web' }, message: 'ordinary error' };
  expect(sanitizeSubjectCoverEvent(ordinary)).toBe(ordinary);
});
