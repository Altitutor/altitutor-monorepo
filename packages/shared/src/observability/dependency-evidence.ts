const endpoints = ['auth_user', 'auth_jwks', 'auth_refresh', 'student_portal_access', 'tutor_profile', 'other'] as const;
const operations = ['create_client', 'get_claims', 'student_portal_access', 'tutor_profile'] as const;
type Operation = (typeof operations)[number];
type Endpoint = (typeof endpoints)[number];
type RequestState = 'headers_pending' | 'headers_received' | 'body_pending' | 'body_complete' | 'body_rejected' | 'fetch_rejected';
type Rejection = 'abort' | 'timeout' | 'other';
type RequestEvidence = {
  endpoint: Endpoint; state: RequestState; started_ms: number;
  headers_ms?: number; body_started_ms?: number; settled_ms?: number;
  status?: number; request_id?: string; rejection?: Rejection;
  trace_id?: string; trace_source?: 'existing' | 'diagnostic';
  local_deadline_at_rejection?: boolean; effective_signal_aborted?: boolean;
};
type OperationEvidence = {
  operation: Operation; state: 'pending' | 'complete' | 'rejected';
  started_ms: number; settled_ms?: number; network: 'observed' | 'none_observed';
};
export type DependencyEvidenceSnapshot = {
  version: 1; elapsed_ms: number; local_deadline_expired: boolean; deadline_ms?: number;
  incoming_signal_aborted?: boolean; incoming_signal_observed_ms?: number;
  vercel_id?: string; operations: OperationEvidence[]; requests: RequestEvidence[];
  dropped_requests: number; dropped_operations: number;
};

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
}
function ms(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.min(60_000, Math.round(value)) : undefined;
}
function uuid(value: unknown): string | undefined {
  return typeof value === 'string' && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value) ? value : undefined;
}
function vercelId(value: unknown): string | undefined {
  return typeof value === 'string' && /^[a-z\d]{2,12}(?:::[a-z\d]{2,12})?::[a-z\d]{4,12}-\d{13}-[a-f\d]{12}$/i.test(value) ? value : undefined;
}
function traceId(value: unknown): string | undefined {
  return typeof value === 'string' && /^[a-f\d]{32}$/.test(value) && !/^0+$/.test(value) ? value : undefined;
}
function traceparent(value: string | null): string | undefined {
  const match = value?.match(/^00-([a-f\d]{32})-([a-f\d]{16})-[a-f\d]{2}$/);
  return match && traceId(match[1]) && !/^0+$/.test(match[2]) ? match[1] : undefined;
}
function rejection(error: unknown): Rejection {
  try {
    const name = record(error).name;
    return name === 'AbortError' ? 'abort' : name === 'TimeoutError' ? 'timeout' : 'other';
  } catch { return 'other'; }
}

/** Fixed labels only. Never retain a URL, query, payload, error text, or auth data. */
function endpoint(input: RequestInfo | URL, supabaseUrl?: string): Endpoint {
  try {
    const target = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (!supabaseUrl || target.origin !== new URL(supabaseUrl).origin) return 'other';
    switch (target.pathname) {
      case '/auth/v1/user': return 'auth_user';
      case '/auth/v1/.well-known/jwks.json': return 'auth_jwks';
      case '/auth/v1/token': return target.searchParams.get('grant_type') === 'refresh_token' ? 'auth_refresh' : 'other';
      case '/rest/v1/rpc/current_student_portal_access': return 'student_portal_access';
      case '/rest/v1/vtutor_profile': return 'tutor_profile';
      default: return 'other';
    }
  } catch { return 'other'; }
}

/** Request-local observer. It never starts a request, reads a body, or changes a signal. */
export function createDependencyEvidence(options: { supabaseUrl?: string; incomingSignal?: AbortSignal; vercelId?: unknown }) {
  const started = Date.now();
  const requests: RequestEvidence[] = [];
  const history: Array<OperationEvidence & { requestCount: number }> = [];
  let requestCount = 0;
  let operationCount = 0;
  let deadline: number | undefined;
  let incomingObserved: number | undefined;
  let invocationId = vercelId(options.vercelId);
  const elapsed = () => Math.min(60_000, Math.max(0, Date.now() - started));
  const observeIncoming = () => {
    if (options.incomingSignal?.aborted && incomingObserved === undefined) incomingObserved = elapsed();
  };
  const rejected = (entry: RequestEvidence, error: unknown, signal?: AbortSignal | null) => {
    entry.rejection = rejection(error);
    entry.local_deadline_at_rejection = deadline !== undefined;
    if (signal) entry.effective_signal_aborted = signal.aborted;
    entry.settled_ms = elapsed();
  };
  return {
    invocation(value: unknown) { invocationId = vercelId(value); },
    deadlineExpired() { deadline ??= elapsed(); },
    async operation<T>(operation: Operation, action: () => PromiseLike<T>): Promise<T> {
      operationCount += 1;
      const entry: OperationEvidence & { requestCount: number } = { operation, state: 'pending', started_ms: elapsed(), network: 'none_observed', requestCount };
      if (history.length < 8) history.push(entry);
      try {
        const result = await action();
        entry.state = 'complete';
        return result;
      } catch (error) {
        entry.state = 'rejected';
        throw error;
      } finally {
        entry.settled_ms = elapsed();
        entry.network = requestCount > entry.requestCount ? 'observed' : 'none_observed';
      }
    },
    fetch(transport: typeof fetch): typeof fetch {
      return async (input, init) => {
        requestCount += 1;
        // Once full, transparently delegate rather than adding more wrappers/work.
        if (requests.length >= 12) return transport(input, init);
        const entry: RequestEvidence = { endpoint: endpoint(input, options.supabaseUrl), started_ms: elapsed(), state: 'headers_pending' };
        requests.push(entry);
        let forwarded = init;
        try {
          if (entry.endpoint !== 'other') {
            const headers = new Headers(init?.headers ?? (typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined));
            const current = headers.get('traceparent');
            if (current !== null) {
              entry.trace_id = traceparent(current);
              if (entry.trace_id) entry.trace_source = 'existing';
            } else {
              // Gateway log correlation also works for unsampled traces. This is
              // an opaque diagnostic ID, independent of any sampled Sentry span.
              const trace = crypto.randomUUID().replaceAll('-', '');
              const span = crypto.randomUUID().replaceAll('-', '').slice(0, 16);
              headers.set('traceparent', `00-${trace}-${span}-00`);
              forwarded = { ...init, headers };
              entry.trace_id = trace;
              entry.trace_source = 'diagnostic';
            }
          }
        } catch { /* Keep original arguments when header/crypto observation fails. */ }
        const signal = init?.signal ?? (typeof Request !== 'undefined' && input instanceof Request ? input.signal : undefined);
        observeIncoming();
        let response: Response;
        try {
          response = await transport(input, forwarded);
        } catch (error) {
          entry.state = 'fetch_rejected';
          rejected(entry, error, signal);
          throw error;
        }
        entry.state = 'headers_received';
        entry.headers_ms = elapsed();
        try {
          entry.status = response.status;
          entry.request_id = uuid(response.headers.get('sb-request-id'));
          // Observe the SDK's consumption, preserving identity and native body semantics.
          // No clone/tee/prefetch. A nonextensible response simply loses body evidence.
          for (const method of ['json', 'text', 'arrayBuffer', 'blob', 'formData'] as const) {
            const consume = response[method].bind(response);
            Object.defineProperty(response, method, { configurable: true, writable: true, value: async () => {
              entry.state = 'body_pending';
              entry.body_started_ms = elapsed();
              try {
                const body = await consume();
                entry.state = 'body_complete';
                entry.settled_ms = elapsed();
                return body;
              } catch (error) {
                entry.state = 'body_rejected';
                rejected(entry, error, signal);
                throw error;
              }
            } });
          }
        } catch { /* Diagnostic header/body observation cannot fail the request. */ }
        return response;
      };
    },
    snapshot(): DependencyEvidenceSnapshot {
      observeIncoming();
      return {
        version: 1, elapsed_ms: elapsed(), local_deadline_expired: deadline !== undefined,
        ...(deadline !== undefined ? { deadline_ms: deadline } : {}),
        ...(options.incomingSignal ? { incoming_signal_aborted: options.incomingSignal.aborted } : {}),
        ...(incomingObserved !== undefined ? { incoming_signal_observed_ms: incomingObserved } : {}),
        ...(invocationId ? { vercel_id: invocationId } : {}),
        operations: history.map(({ requestCount: count, ...entry }) => ({ ...entry, network: entry.state === 'pending' && requestCount > count ? 'observed' : entry.network })),
        requests: requests.map(entry => ({ ...entry })),
        dropped_requests: Math.max(0, requestCount - requests.length),
        dropped_operations: Math.max(0, operationCount - history.length),
      };
    },
  };
}
export type DependencyEvidence = ReturnType<typeof createDependencyEvidence>;

/** Rebuild at beforeSend after SDK enrichment; only this small schema survives. */
export function sanitizeDependencyEvidenceEvent<T extends { extra?: Record<string, unknown> }>(event: T): T {
  if (!event.extra || !('dependency_evidence' in event.extra)) return event;
  const source = record(event.extra.dependency_evidence);
  const safe: Record<string, unknown> = {};
  try {
    if (source.version === 1) {
      safe.version = 1;
      for (const key of ['elapsed_ms', 'deadline_ms', 'incoming_signal_observed_ms', 'dropped_requests', 'dropped_operations']) {
        const value = ms(source[key]);
        if (value !== undefined) safe[key] = value;
      }
      for (const key of ['local_deadline_expired', 'incoming_signal_aborted']) if (typeof source[key] === 'boolean') safe[key] = source[key];
      const id = vercelId(source.vercel_id);
      if (id) safe.vercel_id = id;
      safe.operations = (Array.isArray(source.operations) ? source.operations.slice(0, 8) : []).flatMap(value => {
        const item = record(value);
        if (!operations.includes(item.operation as Operation) || !['pending', 'complete', 'rejected'].includes(String(item.state))) return [];
        return [{ operation: item.operation, state: item.state, started_ms: ms(item.started_ms), settled_ms: ms(item.settled_ms), network: item.network === 'observed' ? 'observed' : 'none_observed' }];
      });
      safe.requests = (Array.isArray(source.requests) ? source.requests.slice(0, 12) : []).flatMap(value => {
        const item = record(value);
        if (!endpoints.includes(item.endpoint as Endpoint) || !['headers_pending', 'headers_received', 'body_pending', 'body_complete', 'body_rejected', 'fetch_rejected'].includes(String(item.state))) return [];
        const clean: Record<string, unknown> = { endpoint: item.endpoint, state: item.state };
        for (const key of ['started_ms', 'headers_ms', 'body_started_ms', 'settled_ms']) {
          const value = ms(item[key]);
          if (value !== undefined) clean[key] = value;
        }
        if (typeof item.status === 'number' && Number.isInteger(item.status) && item.status >= 100 && item.status <= 599) clean.status = item.status;
        const id = uuid(item.request_id);
        if (id) clean.request_id = id;
        const trace = traceId(item.trace_id);
        if (trace && ['existing', 'diagnostic'].includes(String(item.trace_source))) {
          clean.trace_id = trace;
          clean.trace_source = item.trace_source;
        }
        if (['abort', 'timeout', 'other'].includes(String(item.rejection))) clean.rejection = item.rejection;
        for (const key of ['local_deadline_at_rejection', 'effective_signal_aborted']) if (typeof item[key] === 'boolean') clean[key] = item[key];
        return [clean];
      });
    }
  } catch { /* Malformed enrichment drops evidence, never the original event. */ }
  const extra: Record<string, unknown> = {};
  if (safe.version === 1) extra.dependency_evidence = safe;
  const original = record(event);
  const tags = record(original.tags);
  const app = tags.app === 'student-web' || tags.app === 'tutor-web' ? tags.app : 'unknown';
  const stage = tags.dependency_stage === 'authentication' ? 'authentication' : 'portal_access';
  const middleware = original.message === 'Middleware dependency unavailable';
  const code = tags.supabase_error_code;
  const safeCode = typeof code === 'string' && (/^(?:[0-9A-Z]{5}|PGRST\d{3})$/.test(code) || ['AuthError', 'AuthApiError', 'AuthRetryableFetchError', 'AuthUnknownError', 'AbortError', 'TimeoutError', 'Error', 'missing_environment', 'invalid_access_payload'].includes(code)) ? code : 'unknown';
  const duration = ms(event.extra.elapsed_ms);
  if (duration !== undefined) extra.elapsed_ms = duration;
  const trace = record(record(original.contexts).trace);
  const safeTrace: Record<string, string> = {};
  if (traceId(trace.trace_id)) safeTrace.trace_id = trace.trace_id as string;
  for (const key of ['span_id', 'parent_span_id']) if (typeof trace[key] === 'string' && /^[a-f\d]{16}$/.test(trace[key])) safeTrace[key] = trace[key];
  // These are existing failure events, not a second success/diagnostic stream.
  // Reconstructing prevents late SDK/scope enrichment from reintroducing PII.
  return {
    event_id: original.event_id, timestamp: original.timestamp, environment: original.environment, release: original.release,
    level: 'error', message: middleware ? 'Middleware dependency unavailable' : 'Portal access dependency unavailable',
    fingerprint: [middleware ? 'middleware-dependency-unavailable' : 'portal-access-unavailable', app, stage],
    tags: { app, dependency_stage: stage, http_status: '503', supabase_error_code: safeCode },
    contexts: { trace: safeTrace }, extra,
  } as unknown as T;
}
