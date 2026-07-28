import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getUcatMcpAggregates } from '@/features/ucat/mcp/server/service'
import { claimUcatMcpAuditTargets } from '@/features/ucat/mcp/server/workflow-service'

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
