import { sanitizeInterviewMediaEvidenceEvent } from '../server/media-evidence';
const roundId = '10000000-0000-4000-8000-000000000001';
const tutorId = '00000000-0000-0000-0000-000000000010';
const requestId = '10000000-0000-4000-8000-000000000004';
const context = { version: 1, operation: 'interview_audio_capture', roundId, tutorId, requestId, role: 'tutor', captureRequested: true, token: 'secret' };
const detail = { version: 1, operation: 'interview_audio_capture', roundId, tutorId, roundExists: true, tutorAssigned: false, creator: true, tutorCount: 1, storedPhase: 'questions', delivery: 'in_person', recording: 'secret' };
it('enriches the original failure event with correlated guard-time evidence and removes arbitrary fields', () => {
  const event = { contexts: { interview_media: context, supabase: { body: { accessKey: 'secret' } } } };
  const result = sanitizeInterviewMediaEvidenceEvent(event, { originalException: { code: '42501', message: 'Round access denied', details: JSON.stringify(detail) } });
  expect(result.contexts.interview_media).toEqual({ version: 1, operation: 'interview_audio_capture', roundId, tutorId, requestId, role: 'tutor', captureRequested: true, guard: { roundExists: true, tutorAssigned: false, creator: true, tutorCount: 1, storedPhase: 'questions', delivery: 'in_person' } });
  expect(JSON.stringify(result)).not.toContain('secret');
});
it.each([
  { ...detail, roundId: '10000000-0000-4000-8000-000000000099' },
  { ...detail, tutorId: '10000000-0000-4000-8000-000000000099' },
  { ...detail, operation: 'interview_video_capture' },
  { ...detail, version: 2 },
])('refuses a guard snapshot that does not match the actual failed call', (invalid) => {
  const result = sanitizeInterviewMediaEvidenceEvent({ contexts: { interview_media: context } }, { originalException: { code: '42501', message: 'Round access denied', details: JSON.stringify(invalid) } });
  expect(result.contexts.interview_media).not.toHaveProperty('guard');
  expect(result.contexts.interview_media).toMatchObject({ roundId, tutorId, requestId });
});
it.each(['', 'not-json', 'x'.repeat(2049)])('keeps known arguments when old deployments omit detail or malformed detail arrives', (details) => {
  expect(sanitizeInterviewMediaEvidenceEvent({ contexts: { interview_media: context } }, { originalException: { code: '42501', message: 'Round access denied', details } }).contexts.interview_media).toMatchObject({ operation: 'interview_audio_capture', roundId, tutorId });
});
it('removes inherited data without changing unrelated error policy', () => {
  const unrelated = { contexts: { other: { secret: 'unrelated' } }, extra: { leave: true } };
  expect(sanitizeInterviewMediaEvidenceEvent(unrelated)).toBe(unrelated);
  const event = { event_id: 'safe-id', exception: { values: [{ value: 'Round access denied' }] }, contexts: { interview_media: context, arbitrary: { secret: 'must-redact' }, trace: { trace_id: 'a'.repeat(32), span_id: 'b'.repeat(16), data: { secret: 'must-redact' } } }, user: { email: 'must-redact' }, extra: { __serialized__: { details: 'must-redact' } }, request: { headers: { cookie: 'must-redact' } }, breadcrumbs: [{ data: { body: 'must-redact' } }], tags: { unsafe: 'must-redact' } };
  const result = sanitizeInterviewMediaEvidenceEvent(event);
  expect(JSON.stringify(result)).not.toContain('must-redact');
  expect(result).toMatchObject({ event_id: 'safe-id', exception: event.exception, contexts: { trace: { trace_id: 'a'.repeat(32), span_id: 'b'.repeat(16) } } });
});

it.each([
  ['syd1::iad1::abcde-1794742000000-abcdef123456', 'syd1::iad1::abcde-1794742000000-abcdef123456'],
  ['Bearer secret', undefined],
  ['syd1::abcde-1794742000000-abcdef123456,secret', undefined],
  ['x'.repeat(1000), undefined],
])('retains only a bounded invocation correlation ID (%s)', (value, expected) => {
  const result = sanitizeInterviewMediaEvidenceEvent({ contexts: { interview_media: { ...context, vercelId: value } } });
  expect((result.contexts.interview_media as { vercelId?: string }).vercelId).toBe(expected);
});
