/** @jest-environment node */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerUcatMcpTools } from '@/features/ucat/mcp/server/register-tools'

jest.mock('server-only', () => ({}))

async function listedToolNames(
  profile: 'authoring' | 'production-maintenance',
): Promise<string[]> {
  const server = new McpServer({ name: `${profile}-test`, version: '1.0.0' })
  registerUcatMcpTools(server, { profile })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'profile-test-client', version: '1.0.0' })
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  try {
    const result = await client.listTools()
    return result.tools.map((tool) => tool.name)
  } finally {
    await client.close()
    await server.close()
  }
}

describe('UCAT MCP tool profiles', () => {
  it('keeps published-content mutation tools off the safe authoring surface', async () => {
    await expect(listedToolNames('authoring')).resolves.toEqual([
      'search_ucat_content',
      'get_ucat_content',
      'get_ucat_reference_data',
      'create_learning_module',
      'update_learning_module',
      'create_question_stem',
      'update_question_stem',
      'create_question_set',
      'update_question_set',
      'create_mock',
      'update_mock',
      'submit_ucat_content_for_review',
      'delete_ucat_content',
      'restore_ucat_content',
      'start_question_generation',
      'get_question_generation_runs',
      'get_question_ai_assessment',
      'request_question_ai_assessment',
      'decide_question_ai_assessment_finding',
      'generate_ucat_image',
      'revise_ucat_image',
      'render_ucat_visual',
      'get_ucat_file',
    ])
  })

  it('exposes a focused production-maintenance surface', async () => {
    await expect(listedToolNames('production-maintenance')).resolves.toEqual([
      'search_ucat_content',
      'get_ucat_content',
      'get_ucat_reference_data',
      'update_published_question_stem',
      'propose_published_question_stem_change',
      'update_published_question_set',
      'propose_published_question_set_change',
      'update_published_mock',
      'propose_published_mock_change',
      'update_published_learning_module',
      'propose_published_learning_module_change',
      'get_ucat_content_changes',
      'apply_ucat_content_changes',
      'reject_ucat_content_change',
      'restore_ucat_content_change',
      'create_ucat_audit_run',
      'add_ucat_audit_run_targets',
      'start_ucat_audit_run',
      'get_ucat_audit_run',
      'claim_ucat_audit_run_targets',
      'finish_ucat_audit_run_target',
      'complete_ucat_audit_run',
      'cancel_ucat_audit_run',
      'get_question_ai_assessment',
      'request_question_ai_assessment',
      'decide_question_ai_assessment_finding',
      'accept_question_ai_assessment_suggestion',
      'generate_ucat_image',
      'revise_ucat_image',
      'render_ucat_visual',
      'get_ucat_file',
    ])
  })
})
