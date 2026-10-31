/** @jest-environment node */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@altitutor/shared'
import { encodeAuthoringRevision } from '@/features/ucat/mcp/server/revision'
import {
  createUcatMcpSupabaseClient,
  verifyUcatMcpToken,
} from '@/features/ucat/mcp/server/auth'
import { createUcatMcpHttpHandler } from '@/features/ucat/mcp/server/http-handler'

jest.mock('server-only', () => ({}))
jest.mock('@/features/ucat/mcp/server/auth', () => ({
  createUcatMcpSupabaseClient: jest.fn(),
  verifyUcatMcpToken: jest.fn().mockResolvedValue({
    token: 'test-token',
    clientId: 'chatgpt-test',
    scopes: ['ucat:read', 'ucat:write'],
  }),
}))

async function requestAt(
  path: string,
  method: 'initialize' | 'tools/list' | 'tools/call',
  params: Record<string, unknown> = {},
) {
  const handler = createUcatMcpHttpHandler()
  return handler(
    new Request(`https://tutor.altitutor.test${path}`, {
      method: 'POST',
      headers: {
        accept: 'application/json, text/event-stream',
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params:
          method === 'initialize'
            ? {
                protocolVersion: '2025-11-25',
                capabilities: {},
                clientInfo: {
                  name: 'ChatGPT',
                  version: 'test',
                },
              }
            : params,
      }),
    }),
  )
}

async function mcpResponsePayload(response: Response) {
  const body = await response.text()
  const data = body
    .split('\n')
    .find((line) => line.startsWith('data: '))
    ?.slice('data: '.length)
  if (!data) throw new Error('MCP response did not contain a data event')
  return JSON.parse(data) as unknown
}

function findTupleItemsSchemas(value: unknown, path = '$'): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      findTupleItemsSchemas(item, `${path}[${index}]`),
    )
  }
  if (!value || typeof value !== 'object') return []

  const object = value as Record<string, unknown>
  const matches = Array.isArray(object.items) ? [`${path}.items`] : []
  return [
    ...matches,
    ...Object.entries(object).flatMap(([key, child]) =>
      findTupleItemsSchemas(child, `${path}.${key}`),
    ),
  ]
}

describe('UCAT MCP HTTP endpoints', () => {
  beforeAll(() => {
    jest.useFakeTimers()
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  it('initializes the unified authoring server at its advertised URL', async () => {
    const response = await requestAt('/api/mcp', 'initialize')

    expect(response.status).toBe(200)
    await expect(mcpResponsePayload(response)).resolves.toMatchObject({
      result: {
        serverInfo: {
          name: 'altitutor-ucat-authoring',
        },
      },
    })
  })

  it('calls the contract tool through the real transport and rejects malformed arguments', async () => {
    const response = await requestAt('/api/mcp', 'tools/call', {
      name: 'get_ucat_mcp_capabilities',
      arguments: {},
    })
    expect(response.status).toBe(200)
    expect(await mcpResponsePayload(response)).toMatchObject({
      result: {
        structuredContent: {
          features: { explicitStemReplacement: true, databaseBlueprints: true },
        },
      },
    })
    const invalid = await requestAt('/api/mcp', 'tools/call', {
      name: 'get_ucat_content',
      arguments: { contentType: 'question_stem', id: 'invalid-id' },
    })
    expect(await mcpResponsePayload(invalid)).toMatchObject({
      result: { isError: true },
    })
  })

  it('accepts the existing maximum of 100 operations with 500 stem IDs each', async () => {
    const id = '60000000-0000-4000-8000-000000000001'
    const updatedAt = '2026-10-25T00:00:00.000Z'
    const stemIds = Array.from(
      { length: 500 },
      (_, index) =>
        `70000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`,
    )
    const client = {
      rpc: jest.fn().mockResolvedValue({ data: { id }, error: null }),
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id,
                section_id: '80000000-0000-4000-8000-000000000001',
                reference_blueprint_id: '80000000-0000-4000-8000-000000000002',
                updated_at: updatedAt,
                stems: [],
                timing_mode: 'untimed',
                set_format: 'partial_section',
                access_scope: 'public',
                status: 'draft',
              },
              error: null,
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient<Database>
    jest.mocked(createUcatMcpSupabaseClient).mockReturnValueOnce(client)
    const response = await requestAt('/api/mcp', 'tools/call', {
      name: 'change_question_set',
      arguments: {
        id,
        revision: encodeAuthoringRevision(id, updatedAt),
        summary: 'Retain the complete ordered stem membership.',
        operations: Array.from({ length: 100 }, () => ({
          type: 'replace_stems',
          stemIds,
        })),
      },
    })
    expect(response.status).toBe(200)
    expect(await mcpResponsePayload(response)).toMatchObject({
      result: {
        structuredContent: { effect: 'applied', aggregate: { id } },
      },
    })
  })

  it('rechecks authority for each request without retaining a previous caller', async () => {
    await requestAt('/api/mcp', 'tools/list')
    jest.mocked(verifyUcatMcpToken).mockResolvedValueOnce(undefined)
    const denied = await requestAt('/api/mcp', 'tools/list')
    expect(denied.status).toBe(401)
    expect(denied.headers.get('www-authenticate')).toContain(
      '/.well-known/oauth-protected-resource',
    )
    expect((await requestAt('/api/mcp', 'tools/list')).status).toBe(200)
  })

  it('rejects excessive argument elements before invoking an authoring tool', async () => {
    const response = await requestAt('/api/mcp', 'tools/call', {
      name: 'get_ucat_mcp_capabilities',
      arguments: { surplus: Array(100_001).fill(null) },
    })
    expect(await mcpResponsePayload(response)).toMatchObject({
      result: { isError: true },
    })
  })

  it('lists one lifecycle-aware tool catalogue', async () => {
    const response = await requestAt('/api/mcp', 'tools/list')

    expect(response.status).toBe(200)
    const payload = await mcpResponsePayload(response)
    expect(payload).toMatchObject({
      result: {
        tools: expect.arrayContaining([
          expect.objectContaining({ name: 'create_question_stem' }),
          expect.objectContaining({ name: 'change_question_stem' }),
          expect.objectContaining({ name: 'get_ucat_mcp_capabilities' }),
          expect.objectContaining({ name: 'list_ucat_blueprints' }),
          expect.objectContaining({ name: 'validate_mock_composition' }),
          expect.objectContaining({ name: 'apply_ucat_content_changes' }),
        ]),
      },
    })
    expect(
      (payload as { result: { tools: unknown[] } }).result.tools,
    ).toHaveLength(42)

    const tools = (
      payload as {
        result: { tools: Array<{ name: string; inputSchema: unknown }> }
      }
    ).result.tools
    const incompatibleSchemas = tools.flatMap((tool) =>
      findTupleItemsSchemas(tool.inputSchema).map(
        (path) => `${tool.name}: ${path}`,
      ),
    )
    expect(incompatibleSchemas).toEqual([])

    const visualTool = tools.find((tool) => tool.name === 'render_ucat_visual')
    expect(visualTool).toBeDefined()
    expect(JSON.stringify(visualTool?.inputSchema)).not.toContain('"not"')
    expect(JSON.stringify(visualTool?.inputSchema)).toContain('venn_diagram')
    expect(JSON.stringify(visualTool?.inputSchema)).toContain('set_diagram')
    expect(JSON.stringify(visualTool?.inputSchema)).toContain('shapes')
    expect(JSON.stringify(visualTool?.inputSchema)).toContain('regionLabels')
  })
})
