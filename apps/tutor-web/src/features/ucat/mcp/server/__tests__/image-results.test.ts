/** @jest-environment node */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@altitutor/shared'
import { Blob as NodeBlob } from 'node:buffer'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js'
import sharp from 'sharp'
import { getUcatMcpFile } from '@/features/ucat/mcp/server/media'
import { registerUcatMcpTools } from '@/features/ucat/mcp/server/register-tools'

jest.mock('server-only', () => ({}))

const FILE_ID = '60000000-0000-0000-0000-000000000001'
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

async function connectedClient(
  register: (server: McpServer) => void,
): Promise<{ client: Client; close: () => Promise<void> }> {
  const server = new McpServer({ name: 'image-result-test', version: '1.0.0' })
  register(server)

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const send = clientTransport.send.bind(clientTransport)
  clientTransport.send = (message, options) => send(message, {
    ...options,
    authInfo: {
      token: 'test-token',
      clientId: 'test-client',
      scopes: ['ucat:read', 'ucat:write'],
    },
  })

  const client = new Client({ name: 'image-result-test-client', version: '1.0.0' })
  await server.connect(serverTransport)
  await client.connect(clientTransport)

  return {
    client,
    close: async () => {
      await client.close()
      await server.close()
    },
  }
}

describe('UCAT MCP image tool results', () => {
  it('returns an accessible stored image as native MCP image content with metadata', async () => {
    const metadata = {
      id: FILE_ID,
      filename: 'diagram.png',
      mimetype: 'image/png',
      size_bytes: 68,
      signedUrl: 'https://storage.example.test/signed-image',
    }
    const fakeClient = {} as SupabaseClient<Database>
    const connection = await connectedClient((server) => {
      registerUcatMcpTools(server, {
        createClient: () => fakeClient,
        getFile: async () => ({
          metadata,
          image: {
            type: 'image',
            data: TINY_PNG_BASE64,
            mimeType: 'image/png',
          },
        }),
      })
    })

    try {
      const result = CallToolResultSchema.parse(await connection.client.callTool({
        name: 'get_ucat_file',
        arguments: { fileId: FILE_ID },
      }))

      expect(result.isError).not.toBe(true)
      expect(result.structuredContent).toEqual(metadata)
      expect(result.content).toEqual([
        {
          type: 'text',
          text: JSON.stringify(metadata, null, 2),
        },
        {
          type: 'image',
          data: TINY_PNG_BASE64,
          mimeType: 'image/png',
        },
      ])
    } finally {
      await connection.close()
    }
  })

  it('returns a generated image as native MCP image content without storing bytes in metadata', async () => {
    const generated = {
      fileId: FILE_ID,
      storagePath: 'generated/test/diagram.png',
      signedUrl: 'https://storage.example.test/generated-image',
      alt: 'A generated diagram',
      imageNode: {
        type: 'image',
        attrs: {
          src: 'https://storage.example.test/generated-image',
          alt: 'A generated diagram',
          fileId: FILE_ID,
        },
      },
    }
    const fakeClient = {
      rpc: jest.fn(async (name: string) => {
        if (name === 'tutor_ucat_mcp_begin_idempotency') {
          return { data: { state: 'execute' }, error: null }
        }
        return { data: null, error: null }
      }),
    } as unknown as SupabaseClient<Database>
    const connection = await connectedClient((server) => {
      registerUcatMcpTools(server, {
        createClient: () => fakeClient,
        generateImage: async () => generated,
        getFile: async () => ({
          metadata: {
            id: FILE_ID,
            mimetype: 'image/png',
            signedUrl: generated.signedUrl,
          },
          image: {
            type: 'image',
            data: TINY_PNG_BASE64,
            mimeType: 'image/png',
          },
        }),
      })
    })

    try {
      const result = CallToolResultSchema.parse(await connection.client.callTool({
        name: 'generate_ucat_image',
        arguments: {
          idempotencyKey: 'generated-image-test-key',
          prompt: 'Draw a simple diagram.',
          alt: 'A generated diagram',
        },
      }))

      expect(result.isError).not.toBe(true)
      expect(result.structuredContent).toEqual(generated)
      expect(result.content).toEqual([
        {
          type: 'text',
          text: JSON.stringify(generated, null, 2),
        },
        {
          type: 'image',
          data: TINY_PNG_BASE64,
          mimeType: 'image/png',
        },
      ])
      expect(JSON.stringify(result.structuredContent)).not.toContain(TINY_PNG_BASE64)
    } finally {
      await connection.close()
    }
  })

  it('returns a revised image as native MCP image content', async () => {
    const revised = {
      fileId: FILE_ID,
      storagePath: 'generated/test/revised-diagram.png',
      signedUrl: 'https://storage.example.test/revised-image',
      alt: 'A revised diagram',
      imageNode: {
        type: 'image',
        attrs: {
          src: 'https://storage.example.test/revised-image',
          alt: 'A revised diagram',
          fileId: FILE_ID,
        },
      },
    }
    const fakeClient = {
      rpc: jest.fn(async (name: string) => {
        if (name === 'tutor_ucat_mcp_begin_idempotency') {
          return { data: { state: 'execute' }, error: null }
        }
        return { data: null, error: null }
      }),
    } as unknown as SupabaseClient<Database>
    const connection = await connectedClient((server) => {
      registerUcatMcpTools(server, {
        createClient: () => fakeClient,
        reviseImage: async () => revised,
        getFile: async () => ({
          metadata: {
            id: FILE_ID,
            mimetype: 'image/png',
            signedUrl: revised.signedUrl,
          },
          image: {
            type: 'image',
            data: TINY_PNG_BASE64,
            mimeType: 'image/png',
          },
        }),
      })
    })

    try {
      const result = CallToolResultSchema.parse(await connection.client.callTool({
        name: 'revise_ucat_image',
        arguments: {
          idempotencyKey: 'revised-image-test-key',
          fileId: '60000000-0000-0000-0000-000000000002',
          instructions: 'Make the labels larger.',
          alt: 'A revised diagram',
        },
      }))

      expect(result.isError).not.toBe(true)
      expect(result.structuredContent).toEqual(revised)
      expect(result.content.at(-1)).toEqual({
        type: 'image',
        data: TINY_PNG_BASE64,
        mimeType: 'image/png',
      })
    } finally {
      await connection.close()
    }
  })

  it('returns a deterministic visual as raster MCP image content', async () => {
    const fakeClient = {} as SupabaseClient<Database>
    const connection = await connectedClient((server) => {
      registerUcatMcpTools(server, {
        createClient: () => fakeClient,
      })
    })

    try {
      const result = CallToolResultSchema.parse(await connection.client.callTool({
        name: 'render_ucat_visual',
        arguments: {
          visual: {
            type: 'visual',
            visualType: 'venn_diagram',
            title: 'Two groups',
            altText: 'Two overlapping circles labelled A and B.',
            spec: {
              shapes: [
                { id: 'A', type: 'circle', label: 'A', cx: 285, cy: 205, r: 120 },
                { id: 'B', type: 'circle', label: 'B', cx: 435, cy: 205, r: 120 },
              ],
            },
          },
        },
      }))

      if (result.isError) throw new Error(JSON.stringify(result.content))
      const image = result.content.find((item) => item.type === 'image')
      expect(image).toMatchObject({
        type: 'image',
        mimeType: 'image/png',
      })
      if (!image || image.type !== 'image') throw new Error('Expected an MCP image result')
      const bytes = Buffer.from(image.data, 'base64')
      expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
      expect(bytes.length).toBeLessThanOrEqual(2 * 1024 * 1024)
    } finally {
      await connection.close()
    }
  })

  it('returns a bounded model-facing derivative for an oversized stored image', async () => {
    const original = await sharp({
      create: {
        width: 2400,
        height: 1800,
        channels: 4,
        background: { r: 245, g: 245, b: 245, alpha: 1 },
      },
    }).png().toBuffer()
    const fakeClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: FILE_ID,
                filename: 'large-diagram.png',
                mimetype: 'image/png',
                size_bytes: original.length,
                bucket: 'ucat-images',
                storage_path: 'stored/large-diagram.png',
                external_url: null,
                metadata: {},
                created_at: '2026-07-29T00:00:00.000Z',
              },
              error: null,
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient<Database>
    const storage = {
      createSignedUrl: async () => ({
        data: { signedUrl: 'https://storage.example.test/large-image' },
        error: null,
      }),
      download: async () => ({
        data: new NodeBlob([original], { type: 'image/png' }) as Blob,
        error: null,
      }),
    }
    const connection = await connectedClient((server) => {
      registerUcatMcpTools(server, {
        createClient: () => fakeClient,
        getFile: (client, fileId) => getUcatMcpFile(
          client,
          fileId,
          () => storage,
        ),
      })
    })

    try {
      const result = CallToolResultSchema.parse(await connection.client.callTool({
        name: 'get_ucat_file',
        arguments: { fileId: FILE_ID },
      }))

      if (result.isError) throw new Error(JSON.stringify(result.content))
      const image = result.content.find((item) => item.type === 'image')
      expect(image).toMatchObject({
        type: 'image',
        mimeType: 'image/webp',
      })
      if (!image || image.type !== 'image') throw new Error('Expected an MCP image result')
      expect(Buffer.from(image.data, 'base64').length).toBeLessThanOrEqual(2 * 1024 * 1024)
      expect(JSON.stringify(result.structuredContent)).not.toContain(image.data)
    } finally {
      await connection.close()
    }
  })
})
