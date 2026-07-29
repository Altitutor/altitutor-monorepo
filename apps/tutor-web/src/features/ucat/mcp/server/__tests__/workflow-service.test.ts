import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getUcatMcpAggregate,
  getUcatMcpAggregates,
} from '@/features/ucat/mcp/server/service'
import { encodeAuthoringRevision } from '@/features/ucat/mcp/server/revision'
import {
  applyUcatMcpPendingChange,
  claimUcatMcpAuditTargets,
} from '@/features/ucat/mcp/server/workflow-service'

jest.mock('server-only', () => ({}))
jest.mock('@/features/ucat/mcp/server/service', () => ({
  getUcatMcpAggregate: jest.fn(),
  getUcatMcpAggregates: jest.fn(),
  getUcatMcpAiAssessment: jest.fn(),
}))
jest.mock('@/features/ucat/questions/lib/ai-generation/server-content-blocks', () => ({
  generatedVisualBlockToImageNodeServer: jest.fn(),
}))
jest.mock('@/features/ucat/questions/server/ai-assessment/dispatcher', () => ({
  requestUcatQuestionAssessment: jest.fn(),
}))

const STEM_ID = '60000000-0000-0000-0000-000000000001'
const MODULE_ID = '60000000-0000-0000-0000-000000000002'
const RUN_ID = '60000000-0000-0000-0000-000000000003'
const CHANGE_ID = '60000000-0000-0000-0000-000000000004'
const SET_ID = '60000000-0000-0000-0000-000000000005'

function rpcClient(): SupabaseClient<Database> {
  return {
    rpc: jest.fn().mockResolvedValue({
      data: {
        runId: RUN_ID,
        targets: [
          { content_type: 'stem', content_id: STEM_ID, status: 'in_progress' },
          {
            content_type: 'learning_module',
            content_id: MODULE_ID,
            status: 'in_progress',
          },
        ],
      },
      error: null,
    }),
  } as unknown as SupabaseClient<Database>
}

describe('UCAT MCP audit target claims', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('keeps the lightweight response when content is not requested', async () => {
    const client = rpcClient()
    const result = await claimUcatMcpAuditTargets(client, RUN_ID, 2)

    expect(result.targets).toHaveLength(2)
    expect(getUcatMcpAggregates).not.toHaveBeenCalled()
  })

  it('attaches ordered content and per-target read errors when requested', async () => {
    jest.mocked(getUcatMcpAggregates).mockResolvedValue({
      requestedCount: 2,
      successCount: 1,
      errorCount: 1,
      items: [
        {
          contentType: 'stem',
          id: STEM_ID,
          ok: true,
          content: { id: STEM_ID, revision: 'stem-revision' },
        },
        {
          contentType: 'learning_module',
          id: MODULE_ID,
          ok: false,
          error: 'Module read failed',
        },
      ],
    })

    const result = await claimUcatMcpAuditTargets(rpcClient(), RUN_ID, 2, true)

    expect(getUcatMcpAggregates).toHaveBeenCalledWith(expect.anything(), [
      { contentType: 'stem', id: STEM_ID },
      { contentType: 'learning_module', id: MODULE_ID },
    ])
    expect(result).toMatchObject({
      targets: [
        { content_id: STEM_ID, content: { revision: 'stem-revision' } },
        { content_id: MODULE_ID, contentError: 'Module read failed' },
      ],
      contentReadSummary: {
        requestedCount: 2,
        successCount: 1,
        errorCount: 1,
      },
    })
  })
})

describe('UCAT MCP pending audit changes', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('reasserts the audit run authority when applying a deferred proposal', async () => {
    const revision = encodeAuthoringRevision(SET_ID, '2026-07-29T01:00:00.000Z')
    jest.mocked(getUcatMcpAggregate).mockResolvedValue({
      id: SET_ID,
      revision,
    })
    const rpc = jest.fn()
      .mockResolvedValueOnce({
        data: {
          items: [{
            id: CHANGE_ID,
            target_type: 'set',
            target_id: SET_ID,
            status: 'pending',
            source: 'audit_run',
            audit_run_id: RUN_ID,
            base_revision: revision,
            resulting_revision: null,
            base_snapshot: { id: SET_ID },
            proposed_snapshot: { id: SET_ID },
            operations: [],
            summary: 'Audit correction',
            rationale: null,
            finding_refs: [],
            reverse_of_change_id: null,
          }],
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { changeId: CHANGE_ID },
        error: null,
      })
    const client = { rpc } as unknown as SupabaseClient<Database>

    await applyUcatMcpPendingChange(client, CHANGE_ID)

    expect(rpc).toHaveBeenNthCalledWith(
      2,
      'tutor_ucat_mcp_apply_content_change',
      expect.objectContaining({
        p_existing_change_id: CHANGE_ID,
        p_audit_run_id: RUN_ID,
      }),
    )
  })
})
