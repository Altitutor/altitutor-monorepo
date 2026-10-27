/** @jest-environment node */

import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createUcatMcpQuestionSet, updateUcatMcpQuestionSet } from '../service'
import { encodeAuthoringRevision } from '../revision'
import { CreateQuestionSetInputSchema, type QuestionSetOperation } from '../schemas'

jest.mock('server-only', () => ({}))

const SET_ID = '60000000-0000-4000-8000-000000000001'
const SECTION_ID = '60000000-0000-4000-8000-000000000002'
const BLUEPRINT_ID = '60000000-0000-4000-8000-000000000003'
const UPDATED_AT = '2026-10-25T00:00:00.000Z'

function fixture(timing = { timing_mode: 'pace', pace_multiplier: 1.5 as number | null,
  fixed_time_limit_seconds: null as number | null }) {
  let row = {
    id: SET_ID, updated_at: UPDATED_AT, section_id: SECTION_ID,
    reference_blueprint_id: BLUEPRINT_ID, ...timing, stems: [],
  }
  const rpc = jest.fn(async (_name: string, args: Record<string, unknown>) => {
    row = { ...row, timing_mode: args.p_timing_mode as string,
      pace_multiplier: args.p_pace_multiplier as number | null,
      fixed_time_limit_seconds: args.p_fixed_time_limit_seconds as number | null }
    return { data: { id: SET_ID }, error: null }
  })
  const client = {
    rpc,
    from: () => ({ select: () => ({ eq: () => ({
      maybeSingle: async () => ({ data: { ...row }, error: null }),
    }) }) }),
  } as unknown as SupabaseClient<Database>
  return { client, rpc }
}

describe('MCP question-set timing', () => {
  it.each([
    { timingMode: 'pace', paceMultiplier: 0.7, fixedTimeLimitSeconds: null },
    { timingMode: 'fixed', paceMultiplier: null, fixedTimeLimitSeconds: 120 },
    { timingMode: 'untimed', paceMultiplier: null, fixedTimeLimitSeconds: null },
  ] as const)('supports all starting modes when selecting $timingMode', async (target) => {
    for (const initial of [
      { timing_mode: 'pace', pace_multiplier: 1.5, fixed_time_limit_seconds: null },
      { timing_mode: 'fixed', pace_multiplier: null, fixed_time_limit_seconds: 300 },
      { timing_mode: 'untimed', pace_multiplier: null, fixed_time_limit_seconds: null },
    ]) {
      const { client } = fixture(initial)
      await expect(updateUcatMcpQuestionSet(client, SET_ID, encodeAuthoringRevision(SET_ID, UPDATED_AT),
        [{ type: 'set_metadata', ...target }])).resolves.toMatchObject({
        timing_mode: target.timingMode, pace_multiplier: target.paceMultiplier,
        fixed_time_limit_seconds: target.fixedTimeLimitSeconds,
      })
    }
  })

  it.each([
    { type: 'set_metadata', timingMode: 'fixed' },
    { type: 'set_metadata', paceMultiplier: null },
    { type: 'set_metadata', paceMultiplier: Infinity },
    { type: 'set_metadata', timingMode: 'fixed', fixedTimeLimitSeconds: 1.5 },
  ] satisfies QuestionSetOperation[])('rejects invalid active timing without mutation: %j', async (operation) => {
    const { client, rpc } = fixture()
    await expect(updateUcatMcpQuestionSet(client, SET_ID, encodeAuthoringRevision(SET_ID, UPDATED_AT),
      [operation])).rejects.toThrow(/pace|duration/i)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('preserves existing pace on unrelated metadata changes', async () => {
    const { client } = fixture()
    await expect(updateUcatMcpQuestionSet(client, SET_ID, encodeAuthoringRevision(SET_ID, UPDATED_AT),
      [{ type: 'set_metadata', authoringNote: 'Edited note' }])).resolves.toMatchObject({
      timing_mode: 'pace', pace_multiplier: 1.5, fixed_time_limit_seconds: null,
    })
  })

  it('rejects a create with missing active timing before mutation', async () => {
    const { client, rpc } = fixture()
    const input = CreateQuestionSetInputSchema.parse({
      idempotencyKey: 'create-invalid-timing', sectionId: SECTION_ID, referenceBlueprintId: BLUEPRINT_ID,
      setFormat: 'partial_section', description: {}, timingMode: 'pace',
    })
    await expect(createUcatMcpQuestionSet(client, input)).rejects.toThrow(/pace/i)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('clears persisted pace when a metadata operation selects untimed', async () => {
    const { client, rpc } = fixture()
    const result = await updateUcatMcpQuestionSet(client, SET_ID,
      encodeAuthoringRevision(SET_ID, UPDATED_AT), [{ type: 'set_metadata', timingMode: 'untimed' }])

    expect(result).toMatchObject({ timing_mode: 'untimed', pace_multiplier: null, fixed_time_limit_seconds: null })
    expect(rpc).toHaveBeenCalledWith('tutor_ucat_mcp_upsert_question_set', expect.objectContaining({
      p_timing_mode: 'untimed', p_pace_multiplier: null, p_fixed_time_limit_seconds: null,
    }))
  })

  it('normalizes inactive values on create', async () => {
    const { client } = fixture()
    const input = CreateQuestionSetInputSchema.parse({
      idempotencyKey: 'create-timing-test', sectionId: SECTION_ID, referenceBlueprintId: BLUEPRINT_ID,
      setFormat: 'partial_section', description: {}, timingMode: 'untimed', paceMultiplier: 1.5,
      fixedTimeLimitSeconds: 120,
    })
    await expect(createUcatMcpQuestionSet(client, input)).resolves.toMatchObject({
      timing_mode: 'untimed', pace_multiplier: null, fixed_time_limit_seconds: null,
    })
  })
})
