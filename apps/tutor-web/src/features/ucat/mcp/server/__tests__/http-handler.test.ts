/** @jest-environment node */

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
  method: 'initialize' | 'tools/list',
) {
  const handler = createUcatMcpHttpHandler()
  return handler(new Request(`https://tutor.altitutor.test${path}`, {
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
      params: method === 'initialize'
        ? {
            protocolVersion: '2025-11-25',
            capabilities: {},
            clientInfo: {
              name: 'ChatGPT',
              version: 'test',
            },
          }
        : {},
    }),
  }))
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
    return value.flatMap((item, index) => findTupleItemsSchemas(item, `${path}[${index}]`))
  }
  if (!value || typeof value !== 'object') return []

  const object = value as Record<string, unknown>
  const matches = Array.isArray(object.items) ? [`${path}.items`] : []
  return [
    ...matches,
    ...Object.entries(object).flatMap(([key, child]) => (
      findTupleItemsSchemas(child, `${path}.${key}`)
    )),
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

  it('lists one lifecycle-aware tool catalogue', async () => {
    const response = await requestAt('/api/mcp', 'tools/list')

    expect(response.status).toBe(200)
    const payload = await mcpResponsePayload(response)
    expect(payload).toMatchObject({
      result: {
        tools: expect.arrayContaining([
          expect.objectContaining({ name: 'create_question_stem' }),
          expect.objectContaining({ name: 'change_question_stem' }),
          expect.objectContaining({ name: 'apply_ucat_content_changes' }),
        ]),
      },
    })
    expect((payload as { result: { tools: unknown[] } }).result.tools)
      .toHaveLength(37)

    const tools = (payload as {
      result: { tools: Array<{ name: string; inputSchema: unknown }> }
    }).result.tools
    const incompatibleSchemas = tools
      .flatMap((tool) => findTupleItemsSchemas(tool.inputSchema)
        .map((path) => `${tool.name}: ${path}`))
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
