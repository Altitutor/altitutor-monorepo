import { createDependencyEvidence, sanitizeDependencyEvidenceEvent } from './dependency-evidence';

const url = 'https://project.supabase.co';
const requestId = '7034c5c4-b753-4d55-97db-e265d96ca17c';

describe('request-owned dependency evidence', () => {
  test('omits incoming cancellation when no request signal is available and preserves known observations', () => {
    expect(createDependencyEvidence({ supabaseUrl: url }).snapshot()).not.toHaveProperty('incoming_signal_aborted');
    const controller = new AbortController();
    const evidence = createDependencyEvidence({ supabaseUrl: url, incomingSignal: controller.signal });
    expect(evidence.snapshot().incoming_signal_aborted).toBe(false);
    controller.abort();
    expect(evidence.snapshot().incoming_signal_aborted).toBe(true);
  });
  test('retains headers and a pending body at the deadline without consuming or cloning it', async () => {
    let finish!: (value: string) => void;
    const response = new Response(null, { status: 200, headers: { 'sb-request-id': requestId } });
    response.text = () => new Promise(resolve => { finish = resolve; });
    const transport = jest.fn(async () => response);
    const evidence = createDependencyEvidence({ supabaseUrl: url });
    const result = await evidence.fetch(transport)(`${url}/rest/v1/rpc/current_student_portal_access?secret=token`);
    expect(result).toBe(response);
    expect(response.bodyUsed).toBe(false);
    const body = result.text();
    evidence.deadlineExpired();
    const captured = evidence.snapshot();
    expect(captured).toMatchObject({ local_deadline_expired: true, requests: [{ endpoint: 'student_portal_access', status: 200, request_id: requestId, state: 'body_pending' }] });
    finish('private response');
    await expect(body).resolves.toBe('private response');
    expect(evidence.snapshot().requests[0].state).toBe('body_complete');
    expect(captured.requests[0].state).toBe('body_pending');
    expect(transport).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(captured)).not.toMatch(/secret|private|supabase.co/);
  });

  test('distinguishes no network before a failure from a request waiting for headers', async () => {
    const evidence = createDependencyEvidence({ supabaseUrl: url });
    const waiting = evidence.operation('student_portal_access', () => new Promise(() => {}));
    void waiting;
    expect(evidence.snapshot()).toMatchObject({ operations: [{ state: 'pending', network: 'none_observed' }], requests: [] });
    void evidence.fetch(() => new Promise(() => {}))(`${url}/auth/v1/token?grant_type=refresh_token`);
    expect(evidence.snapshot()).toMatchObject({ requests: [{ endpoint: 'auth_refresh', state: 'headers_pending' }] });
  });

  test('observes cancellation without propagating or confusing an incoming signal with the local deadline', async () => {
    const incoming = new AbortController();
    const effective = new AbortController();
    const evidence = createDependencyEvidence({ supabaseUrl: url, incomingSignal: incoming.signal });
    incoming.abort('private reason');
    const failure = new DOMException('private upstream message', 'AbortError');
    await expect(evidence.fetch(async () => { throw failure; })(`${url}/auth/v1/user`, { signal: effective.signal })).rejects.toBe(failure);
    expect(effective.signal.aborted).toBe(false);
    evidence.deadlineExpired();
    expect(evidence.snapshot()).toMatchObject({ incoming_signal_aborted: true, requests: [{ state: 'fetch_rejected', rejection: 'abort', local_deadline_at_rejection: false, effective_signal_aborted: false }] });
  });

  test('keeps concurrent collectors isolated and bounds diagnostic history', async () => {
    const left = createDependencyEvidence({ supabaseUrl: url });
    const right = createDependencyEvidence({ supabaseUrl: url });
    await Promise.all([left.operation('get_claims', async () => 1), right.operation('tutor_profile', async () => 2)]);
    for (let i = 0; i < 40; i++) await left.fetch(async () => new Response())(`${url}/auth/v1/user`);
    expect(left.snapshot().requests).toHaveLength(12);
    expect(left.snapshot().dropped_requests).toBe(28);
    expect(right.snapshot().requests).toEqual([]);
    expect(right.snapshot().operations).toEqual([expect.objectContaining({ operation: 'tutor_profile', network: 'none_observed' })]);
  });

  test('retains a gateway correlation key before headers and only tags known project calls', async () => {
    const evidence = createDependencyEvidence({ supabaseUrl: url });
    const transport = jest.fn((_input: RequestInfo | URL, _init?: RequestInit) => new Promise<Response>(() => {}));
    void evidence.fetch(transport)(new Request(`${url}/auth/v1/user`, { headers: { authorization: 'Bearer private' } }));
    const init = transport.mock.calls[0][1];
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe('Bearer private');
    expect(headers.get('traceparent')).toMatch(/^00-[a-f\d]{32}-[a-f\d]{16}-00$/);
    expect(evidence.snapshot().requests[0]).toMatchObject({ trace_id: headers.get('traceparent')?.split('-')[1], trace_source: 'diagnostic' });
    const existing = '00-12345678901234567890123456789012-1234567890123456-01';
    void evidence.fetch(transport)(`${url}/auth/v1/user`, { headers: { traceparent: existing } });
    expect(new Headers(transport.mock.calls[1][1]?.headers).get('traceparent')).toBe(existing);
    const untouched = { headers: { authorization: 'Bearer private' } };
    void evidence.fetch(transport)('https://external.test/auth/v1/user', untouched);
    expect(transport.mock.calls[2][1]).toBe(untouched);
  });

  test('unavailable crypto, malformed header enrichment and nonextensible responses fail open', async () => {
    const evidence = createDependencyEvidence({ supabaseUrl: url });
    const original = { headers: { authorization: 'private' } };
    const response = Object.freeze(new Response('body'));
    const transport = jest.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response);
    const random = jest.spyOn(crypto, 'randomUUID').mockImplementationOnce(() => { throw new Error('unavailable'); });
    try {
      expect(await evidence.fetch(transport)(`${url}/auth/v1/user`, original)).toBe(response);
      expect(transport.mock.calls[0][1]).toBe(original);
      await expect(response.text()).resolves.toBe('body');
      const malformed = { headers: { 'invalid\nname': 'private' } };
      await evidence.fetch(transport)(`${url}/auth/v1/user`, malformed);
      expect(transport.mock.calls[1][1]).toBe(malformed);
      expect(transport).toHaveBeenCalledTimes(2);
      expect(JSON.stringify(evidence.snapshot())).not.toContain('private');
    } finally { random.mockRestore(); }
  });

  test('parallel outgoing correlation stays independent and malformed existing context is never serialized', async () => {
    const left = createDependencyEvidence({ supabaseUrl: url });
    const right = createDependencyEvidence({ supabaseUrl: url });
    const transport = async () => new Response();
    await Promise.all([left.fetch(transport)(`${url}/auth/v1/user`), right.fetch(transport)(`${url}/auth/v1/user`)]);
    expect(left.snapshot().requests[0].trace_id).not.toBe(right.snapshot().requests[0].trace_id);
    const forwarded = jest.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response());
    const original = { headers: { traceparent: 'private-invalid-trace' } };
    await left.fetch(forwarded)(`${url}/auth/v1/user`, original);
    expect(forwarded.mock.calls[0][1]).toBe(original);
    expect(JSON.stringify(left.snapshot())).not.toContain('private');
    expect(left.snapshot().requests[1].trace_id).toBeUndefined();
  });

  test('final event sanitizer removes arbitrary fields and rejects malformed correlation IDs', () => {
    const evidence = createDependencyEvidence({ supabaseUrl: url, vercelId: 'syd1::bbp6w-1794708426371-2e8f5db32150' }).snapshot();
    const event = sanitizeDependencyEvidenceEvent({ extra: { dependency_evidence: { ...evidence, token: 'private', requests: [{ endpoint: 'auth_user', state: 'fetch_rejected', started_ms: 0, request_id: 'name@example.test', url: 'private' }] }, existing: 1 } });
    expect(event.extra.existing).toBeUndefined();
    expect(event.extra.dependency_evidence).toMatchObject({ vercel_id: 'syd1::bbp6w-1794708426371-2e8f5db32150', requests: [{ endpoint: 'auth_user' }] });
    expect(JSON.stringify(event)).not.toMatch(/private|example.test|token/);
  });

  test('final failure event excludes realistic inherited secrets as well as diagnostic field contamination', () => {
    const safe = sanitizeDependencyEvidenceEvent({
      message: 'Portal access dependency unavailable', tags: { app: 'tutor-web', dependency_stage: 'portal_access', supabase_error_code: '57014', private: 'secret-person' },
      request: { url: 'https://app.test/round?token=secret-url', headers: { authorization: 'secret-authorization' }, data: 'secret-body' },
      user: { email: 'secret-user@example.test' }, breadcrumbs: [{ data: { body: 'secret-breadcrumb' } }],
      contexts: { supabase: { body: 'secret-rpc-args', query: 'secret-query' }, trace: { trace_id: '12345678901234567890123456789012', span_id: '1234567890123456', data: 'secret-span' } },
      extra: { dependency_evidence: createDependencyEvidence({ supabaseUrl: url }).snapshot(), error_message: 'secret-error', cookies: 'secret-cookie', elapsed_ms: 12 },
    });
    expect(JSON.stringify(safe)).not.toMatch(/secret|example.test/);
    expect(safe).toMatchObject({ tags: { supabase_error_code: '57014' }, contexts: { trace: { trace_id: '12345678901234567890123456789012' } }, extra: { elapsed_ms: 12 } });
  });
});
