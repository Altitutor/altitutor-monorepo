const operations = ['upload', 'delete', 'sign', 'link', 'retire_previous'] as const;
type Operation = (typeof operations)[number];
type Portal = 'admin-web' | 'student-web' | 'tutor-web';

type Diagnostic = {
  object_hash: string;
  operation: Operation;
  outcome: 'ok' | 'error' | 'threw';
  duration_ms: number;
  started_at_ms: number;
  code: string;
};
type CoverEvent = {
  type: undefined;
  message: string;
  level: 'info' | 'warning';
  fingerprint: string[];
  tags: { 'subject_cover.diagnostic': 'true'; app: Portal };
  contexts: { subject_cover: Diagnostic };
};

function safeCode(error: unknown): string {
  if (!error || typeof error !== 'object' || !('code' in error)) return 'unknown';
  const code = error.code;
  // Never retain arbitrary provider messages, URLs, object names, or payloads.
  return typeof code === 'string' && ['NoSuchKey', 'not_found', 'AccessDenied', '23503', '23505', '42501'].includes(code)
    ? code : 'unknown';
}

/** Observes only subject covers. No network lookup, retry, or mutation is added. */
export function createSubjectCoverObserver(app: Portal, capture: (event: CoverEvent) => unknown) {
  let windowStarted = Date.now();
  let count = 0;
  const report = async (bucket: string, path: string, diagnostic: Omit<Diagnostic, 'object_hash'>) => {
    try {
      if (bucket !== 'resources' || !/^[^/]+\/_subject_image\/[^/]+$/.test(path)) return;
      // Successful signs are routine; writer outcomes and failed signs establish the timeline.
      if (diagnostic.operation === 'sign' && diagnostic.outcome === 'ok') return;
      const now = Date.now();
      if (now < windowStarted || now - windowStarted >= 300_000) { windowStarted = now; count = 0; }
      if (count >= 100) return;
      count += 1;
      const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${bucket}/${path}`));
      const object_hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
      capture({
        type: undefined,
        message: 'Subject cover lifecycle diagnostic',
        level: diagnostic.outcome === 'ok' ? 'info' : 'warning',
        fingerprint: ['subject-cover-lifecycle', diagnostic.operation, diagnostic.outcome],
        tags: { 'subject_cover.diagnostic': 'true', app },
        contexts: { subject_cover: { ...diagnostic, object_hash } },
      });
    } catch { /* Diagnostics must never affect resource access or cleanup. */ }
  };
  return async function observe<T extends { error?: unknown }>(
    bucket: string, path: string, operation: Operation, action: () => PromiseLike<T>,
  ): Promise<T> {
    const started = Date.now();
    try {
      const result = await action();
      void report(bucket, path, {
        operation, outcome: result.error ? 'error' : 'ok',
        duration_ms: Math.max(0, Date.now() - started), started_at_ms: started, code: safeCode(result.error),
      });
      return result;
    } catch (error) {
      void report(bucket, path, {
        operation, outcome: 'threw', duration_ms: Math.max(0, Date.now() - started), started_at_ms: started, code: safeCode(error),
      });
      throw error;
    }
  };
}

/** Runs last after SDK enrichment; inherited URLs/users/breadcrumbs never survive. */
export function sanitizeSubjectCoverEvent<T extends {
  tags?: Record<string, unknown>; contexts?: unknown; event_id?: string;
  timestamp?: number; environment?: string; release?: string;
}>(event: T): T | (CoverEvent & Pick<T, 'event_id' | 'timestamp' | 'environment' | 'release'>) | null {
  if (event.tags?.['subject_cover.diagnostic'] !== 'true') return event;
  const app = event.tags.app;
  const contexts = event.contexts;
  const candidate = contexts && typeof contexts === 'object' && 'subject_cover' in contexts ? contexts.subject_cover : null;
  if (!candidate || typeof candidate !== 'object' || !['admin-web', 'student-web', 'tutor-web'].includes(String(app))) return null;
  const d = candidate as Partial<Diagnostic>;
  if (!d.operation || !operations.includes(d.operation) || !d.outcome || !['ok', 'error', 'threw'].includes(d.outcome)
    || typeof d.object_hash !== 'string' || !/^[a-f0-9]{64}$/.test(d.object_hash)
    || typeof d.started_at_ms !== 'number' || !Number.isFinite(d.started_at_ms) || d.started_at_ms < 0
    || typeof d.duration_ms !== 'number' || !Number.isFinite(d.duration_ms) || d.duration_ms < 0) return null;
  return {
    type: undefined, event_id: event.event_id, timestamp: event.timestamp,
    environment: event.environment, release: event.release,
    message: 'Subject cover lifecycle diagnostic', level: d.outcome === 'ok' ? 'info' : 'warning',
    fingerprint: ['subject-cover-lifecycle', d.operation, d.outcome],
    tags: { 'subject_cover.diagnostic': 'true', app: app as Portal },
    contexts: { subject_cover: { object_hash: d.object_hash, operation: d.operation, outcome: d.outcome,
      duration_ms: Math.min(d.duration_ms, 86_400_000), started_at_ms: d.started_at_ms, code: safeCode({ code: d.code }) } },
  };
}
