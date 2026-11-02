/** @jest-environment node */

import { NextRequest } from 'next/server'
import { PATCH } from '../[id]/route'
import { POST } from '../route'
import { createServerClient } from '@supabase/ssr'
import { setDetailToUpdatePayload } from '@/features/ucat/sets/lib/set-payload-mappers'
import { ucatSetsApi } from '@/features/ucat/sets/api/sets'

jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }))
jest.mock('next/headers', () => ({ cookies: () => ({ getAll: () => [], set: jest.fn() }) }))
jest.mock('@sentry/nextjs', () => ({ instrumentSupabaseClient: jest.fn() }))

function authorize(rpc: (name: string, args: Record<string, unknown>) => Promise<unknown>) {
  // Execute the real tutor guard; only the external Supabase boundary is simulated.
  jest.mocked(createServerClient).mockReturnValue({
    rpc: (name: string, args: Record<string, unknown>) => name === 'is_ucat_tutor'
      ? Promise.resolve({ data: true, error: null }) : rpc(name, args),
  } as never)
}

const SET_ID = 'f3000000-0000-4000-8000-000000000001'
const detail = {
  timing_mode: 'pace' as const,
  pace_multiplier: 1.5,
  fixed_time_limit_seconds: null,
  section_id: 'section-id',
  reference_blueprint_id: 'blueprint-id',
  stems: [],
}

describe('question-set timing saves', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    jest.resetAllMocks()
  })

  it.each(['POST', 'PATCH'].flatMap((method) => [
    { method, timingMode: 'untimed', paceMultiplier: null, fixedTimeLimitSeconds: null },
    { method, timingMode: 'pace', paceMultiplier: 1.5, fixedTimeLimitSeconds: null },
    { method, timingMode: 'fixed', paceMultiplier: null, fixedTimeLimitSeconds: 120 },
  ]))('normalizes stale fields for $method $timingMode', async ({ method, ...expected }) => {
    const rpc = jest.fn().mockResolvedValue({ data: SET_ID, error: null })
    authorize(rpc)
    const request = new NextRequest('http://localhost/api/ucat/question-sets', {
      method,
      body: JSON.stringify({ ...expected, paceMultiplier: 1.5, fixedTimeLimitSeconds: 120 }),
    })
    const response = method === 'POST' ? await POST(request)
      : await PATCH(request, { params: Promise.resolve({ id: SET_ID }) })

    expect(response.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('tutor_ucat_upsert_question_set_v2', expect.objectContaining({
      p_timing_mode: expected.timingMode, p_pace_multiplier: expected.paceMultiplier,
      p_fixed_time_limit_seconds: expected.fixedTimeLimitSeconds,
    }))
  })

  it.each([
    { timingMode: 'pace', paceMultiplier: null },
    { timingMode: 'pace', paceMultiplier: 0 },
    { timingMode: 'fixed', fixedTimeLimitSeconds: -1 },
    { timingMode: 'fixed', fixedTimeLimitSeconds: 1.5 },
    { timingMode: 'fixed', fixedTimeLimitSeconds: '120' },
    { timingMode: 'fixed', fixedTimeLimitSeconds: 2147483648 },
    { timingMode: 'unknown' },
    {},
  ].flatMap((timing) => ['POST', 'PATCH'].map((method) => ({ method, timing }))))(
    'rejects invalid active timing before RPC: %j', async ({ method, timing }) => {
    const rpc = jest.fn().mockResolvedValue({ data: SET_ID, error: null })
    authorize(rpc)
    const request = new NextRequest('http://localhost/api/ucat/question-sets', {
      method, body: JSON.stringify(timing),
    })
    const response = method === 'POST' ? await POST(request)
      : await PATCH(request, { params: Promise.resolve({ id: SET_ID }) })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: expect.stringMatching(/timing|pace|duration/i) })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('saves a paced 1.5 set as untimed through the editor mapper, client and PATCH route', async () => {
    // Synthetic DB boundary reproduces the existing untimed constraint, not a new rule.
    const rpc = jest.fn(async (_name: string, args: Record<string, unknown>) => {
      if (args.p_timing_mode === 'untimed' &&
          (args.p_pace_multiplier !== null || args.p_fixed_time_limit_seconds !== null)) {
        return { data: null, error: { message: '23514: question_sets_timing_intent_check' } }
      }
      return { data: SET_ID, error: null }
    })
    authorize(rpc)
    global.fetch = jest.fn(async (_url: unknown, init?: RequestInit) => PATCH(
      new NextRequest(`http://localhost/api/ucat/question-sets/${SET_ID}`, {
        method: init?.method, headers: init?.headers, body: init?.body,
      }),
      { params: Promise.resolve({ id: SET_ID }) },
    )) as typeof fetch

    const payload = setDetailToUpdatePayload(detail, {
      timingMode: 'untimed', paceMultiplier: null, fixedTimeLimitSeconds: null,
    })
    expect(payload).toMatchObject({
      timingMode: 'untimed', paceMultiplier: null, fixedTimeLimitSeconds: null,
    })

    await expect(ucatSetsApi.update(SET_ID, payload)).resolves.toEqual({ id: SET_ID })
    expect(rpc).toHaveBeenCalledWith('tutor_ucat_upsert_question_set_v2', expect.objectContaining({
      p_timing_mode: 'untimed', p_pace_multiplier: null, p_fixed_time_limit_seconds: null,
    }))
  })
})
