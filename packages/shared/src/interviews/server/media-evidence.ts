/** Server-only, allowlisted evidence for the existing media failure event. */
export interface InterviewMediaEvidence {
  version: 1;
  operation: 'resolve_actor' | 'round_view' | 'current_tutor_id' | 'interview_media_state' | 'interview_media_policy_state' | 'interview_audio_capture' | 'interview_video_capture' | 'interview_media_ticket';
  roundId: string;
  tutorId?: string;
  captureRequested: boolean;
  role: 'tutor' | 'student';
}

/** Same bounded opaque invocation-ID format as the dependency evidence collector. */
export function interviewMediaVercelId(value: unknown): string | undefined {
  return typeof value === 'string' && /^[a-z\d]{2,12}(?:::[a-z\d]{2,12})?::[a-z\d]{4,12}-\d{13}-[a-f\d]{12}$/i.test(value) ? value : undefined;
}

const opaqueUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const operations = new Set<unknown>(['resolve_actor', 'round_view', 'current_tutor_id', 'interview_media_state', 'interview_media_policy_state', 'interview_audio_capture', 'interview_video_capture', 'interview_media_ticket']);
const phases = new Set<unknown>(['waiting', 'reading', 'questions', 'feedback', 'completed', null]);
function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
function identifier(value: unknown): value is string {
  return typeof value === 'string' && opaqueUuid.test(value);
}
function guardEvidence(error: unknown, evidence: InterviewMediaEvidence) {
  const failure = record(error);
  if (!failure || failure.code !== '42501' || failure.message !== 'Round access denied' || typeof failure.details !== 'string' || failure.details.length > 2048) return undefined;
  const detail = record(JSON.parse(failure.details));
  if (!detail || detail.version !== 1 || detail.operation !== evidence.operation || detail.roundId !== evidence.roundId || detail.tutorId !== evidence.tutorId || !['interview_audio_capture', 'interview_video_capture'].includes(evidence.operation)) return undefined;
  if (typeof detail.roundExists !== 'boolean' || typeof detail.tutorAssigned !== 'boolean' || typeof detail.creator !== 'boolean' || !Number.isInteger(detail.tutorCount) || Number(detail.tutorCount) < 0 || Number(detail.tutorCount) > 10000 || !phases.has(detail.storedPhase) || !['online', 'in_person', null].includes(detail.delivery as string | null)) return undefined;
  return { roundExists: detail.roundExists, tutorAssigned: detail.tutorAssigned, creator: detail.creator, tutorCount: detail.tutorCount, storedPhase: detail.storedPhase, delivery: detail.delivery };
}

/** Applied last so neither SDK RPC bodies nor arbitrary SQL DETAIL enter media evidence. */
export function sanitizeInterviewMediaEvidenceEvent<T extends { contexts?: Record<string, unknown>; request?: unknown; user?: unknown; breadcrumbs?: unknown }>(event: T, hint?: { originalException?: unknown }): T {
  if (!event.contexts || !('interview_media' in event.contexts)) return event;
  const contexts: Record<string, unknown> = {};
  const source = event.contexts.interview_media;
  const trace = record(event.contexts.trace);
  if (trace && typeof trace.trace_id === "string" && /^[a-f0-9]{32}$/i.test(trace.trace_id) && typeof trace.span_id === "string" && /^[a-f0-9]{16}$/i.test(trace.span_id)) {
    contexts.trace = { trace_id: trace.trace_id, span_id: trace.span_id };
  }
  try {
    const value = record(source);
    if (value?.version === 1 && operations.has(value.operation) && identifier(value.roundId) && identifier(value.requestId) && (value.role === 'tutor' || value.role === 'student') && typeof value.captureRequested === 'boolean') {
      const evidence: InterviewMediaEvidence & { requestId: string; vercelId?: string; guard?: ReturnType<typeof guardEvidence> } = { version: 1, operation: value.operation as InterviewMediaEvidence['operation'], roundId: value.roundId, requestId: value.requestId, role: value.role, captureRequested: value.captureRequested, ...(value.role === 'tutor' && identifier(value.tutorId) ? { tutorId: value.tutorId } : {}) };
      const vercelId = interviewMediaVercelId(value.vercelId);
      if (vercelId) evidence.vercelId = vercelId;
      // Missing or malformed DETAIL must not discard the independently known operation/arguments.
      try { const guard = guardEvidence(hint?.originalException, evidence); if (guard) evidence.guard = guard; } catch { /* untrusted diagnostic detail */ }
      contexts.interview_media = evidence;
    }
  } catch { /* instrumentation cannot fail the error pipeline */ }
  const sanitized: Record<string, unknown> = { contexts };
  // Keep grouping, stack, release and event identity; all inherited payload is omitted.
  for (const key of ["event_id", "timestamp", "type", "level", "platform", "release", "environment", "exception", "fingerprint", "sdk"]) {
    if (key in event) sanitized[key] = event[key as keyof T];
  }
  return sanitized as T;
}
