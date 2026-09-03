/** @jest-environment node */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerUcatMcpTools } from '@/features/ucat/mcp/server/register-tools'

jest.mock('server-only', () => ({}))

async function listedTools() {
  const server = new McpServer({ name: 'ucat-test', version: '1.0.0' })
  registerUcatMcpTools(server)
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'ucat-test-client', version: '1.0.0' })
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  try {
    const result = await client.listTools()
    return result.tools
  } finally {
    await client.close()
    await server.close()
  }
}

describe('UCAT MCP tool catalogue', () => {
  it('exposes one lifecycle-aware authoring surface', async () => {
    const tools = await listedTools()

    expect(tools.map((tool) => tool.name)).toEqual([
      'search_ucat_content',
      'get_ucat_content',
      'get_ucat_reference_data',
      'get_ucat_mcp_capabilities',
      'list_ucat_blueprints',
      'get_ucat_blueprint',
      'validate_question_set_composition',
      'validate_mock_composition',
      'create_learning_module',
      'change_learning_module',
      'create_question_stem',
      'change_question_stem',
      'create_question_set',
      'change_question_set',
      'create_mock',
      'change_mock',
      'get_ucat_content_changes',
      'apply_ucat_content_changes',
      'reject_ucat_content_change',
      'restore_ucat_content_change',
      'submit_ucat_content_for_review',
      'delete_ucat_content',
      'restore_ucat_content',
      'create_ucat_audit_run',
      'add_ucat_audit_run_targets',
      'start_ucat_audit_run',
      'list_ucat_audit_runs',
      'get_ucat_audit_run',
      'claim_ucat_audit_run_targets',
      'finish_ucat_audit_run_target',
      'complete_ucat_audit_run',
      'cancel_ucat_audit_run',
      'start_question_generation',
      'get_question_generation_runs',
      'get_question_ai_assessment',
      'request_question_ai_assessment',
      'decide_question_ai_assessment_finding',
      'change_question_ai_assessment_suggestion',
      'generate_ucat_image',
      'revise_ucat_image',
      'render_ucat_visual',
      'get_ucat_file',
    ])

    const createAuditRun = tools.find((tool) => tool.name === 'create_ucat_audit_run')
    expect(createAuditRun?.inputSchema).toMatchObject({
      properties: {
        publishedWriteMode: { default: 'apply_valid_changes' },
      },
    })

    const createSet = tools.find((tool) => tool.name === 'create_question_set')
    expect(createSet?.inputSchema).toMatchObject({
      required: expect.arrayContaining(['setFormat', 'sectionId', 'referenceBlueprintId']),
    })
    const createMock = tools.find((tool) => tool.name === 'create_mock')
    expect(createMock?.description).toContain('No sets are created or linked')
    expect(tools.find((tool) => tool.name === 'get_ucat_mcp_capabilities')).toBeDefined()
  })
})
