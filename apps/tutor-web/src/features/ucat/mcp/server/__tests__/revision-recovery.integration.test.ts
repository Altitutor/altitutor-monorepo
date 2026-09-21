/** @jest-environment node */

import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js'
import { createUcatMcpSupabaseClient } from '@/features/ucat/mcp/server/auth'
import { registerUcatMcpTools } from '@/features/ucat/mcp/server/register-tools'

jest.mock('server-only', () => ({}))
jest.mock('@/features/ucat/mcp/server/auth', () => ({
  createUcatMcpSupabaseClient: jest.fn(),
}))

const STEM_ID = '60000000-0000-0000-0000-000000000001'
const SECTION_ID = '60000000-0000-0000-0000-000000000002'

// Only the persistence boundary is simulated. Tool schemas, MCP transport,
// workflow selection, operation reconciliation and revision encoding are real.
function stemFixture() {
  let version = 0
  let beforeNextWrite: (() => void) | undefined
  let row: Record<string, unknown> = {
    id: STEM_ID,
    section_id: SECTION_ID,
    question_stem_category_id: null,
    status: 'draft',
    access_scope: 'public',
    stem_text: { type: 'doc', content: [] },
    tutor_source_note: 'Original note',
    questions: [],
    updated_at: '2026-09-19T00:00:00.000Z',
  }
  function write(fields: Record<string, unknown>) {
    version += 1
    row = {
      ...row,
      ...fields,
      updated_at: `2026-09-19T00:00:0${version}.000Z`,
    }
  }
  const rpc = jest.fn(async (name: string, args: Record<string, unknown>) => {
    expect(name).toBe('tutor_ucat_mcp_upsert_question_stem_bundle')
    expect(args.p_stem_id).toBe(STEM_ID)
    beforeNextWrite?.()
    beforeNextWrite = undefined
    if (args.p_expected_updated_at !== row.updated_at) {
      return { data: null, error: { message: 'mcp_stale_revision' } }
    }
    write({
      stem_text: args.p_stem_text,
      tutor_source_note: args.p_tutor_source_note,
      access_scope: args.p_access_scope,
      questions: args.p_questions,
    })
    return { data: { id: STEM_ID }, error: null }
  })
  const client = {
    rpc,
    from: (view: string) => {
      expect(view).toBe('vtutor_ucat_question_stem_detail')
      return {
        select: () => ({
          eq: (column: string, id: string) => {
            expect([column, id]).toEqual(['id', STEM_ID])
            return { maybeSingle: async () => ({ data: { ...row }, error: null }) }
          },
        }),
      }
    },
  } as unknown as SupabaseClient<Database>
  return {
    client,
    rpc,
    current: () => ({ ...row }),
    raceWithNextWrite: () => {
      beforeNextWrite = () => write({ tutor_source_note: 'Concurrent tutor correction' })
    },
  }
}

async function connect(client: SupabaseClient<Database>) {
  jest.mocked(createUcatMcpSupabaseClient).mockReturnValue(client)
  const server = new McpServer({ name: 'revision-recovery-test', version: '1.0.0' })
  registerUcatMcpTools(server)
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const send = clientTransport.send.bind(clientTransport)
  clientTransport.send = (message, options) => send(message, {
    ...options,
    authInfo: {
      token: 'local-fixture-token',
      clientId: 'revision-recovery-test',
      scopes: ['ucat:read', 'ucat:write'],
    },
  })
  const caller = new Client({ name: 'revision-recovery-client', version: '1.0.0' })
  await server.connect(serverTransport)
  await caller.connect(clientTransport)
  return {
    call: async (name: string, args: Record<string, unknown>) => (
      CallToolResultSchema.parse(await caller.callTool({ name, arguments: args }))
    ),
    close: async () => {
      await caller.close()
      await server.close()
    },
  }
}

describe('UCAT MCP stale revision recovery through registered tools', () => {
  it.each(['before retry', 'between service read and database write'])(
    're-reads and reconciles after a concurrent edit %s',
    async (timing) => {
      const fixture = stemFixture()
      const connection = await connect(fixture.client)
      const read = () => connection.call('get_ucat_content', {
        contentType: 'stem', id: STEM_ID,
      })
      const change = (revision: unknown, metadata: Record<string, unknown>) => (
        connection.call('change_question_stem', {
          id: STEM_ID,
          revision,
          operations: [{ type: 'set_metadata', ...metadata }],
          summary: 'Reconcile the requested correction',
        })
      )
      try {
        const original = await read()
        expect(original.isError).not.toBe(true)
        const originalRevision = original.structuredContent?.revision
        expect(originalRevision).toEqual(expect.any(String))

        if (timing === 'before retry') {
          // A second caller successfully writes against the revision both read.
          const otherEdit = await change(originalRevision, {
            tutorSourceNote: 'Concurrent tutor correction',
          })
          expect(otherEdit.isError).not.toBe(true)
        } else {
          fixture.raceWithNextWrite()
        }

        const stale = await change(originalRevision, { stemText: 'Requested correction' })
        expect(stale.isError).toBe(true)
        expect(stale.content).toEqual([{
          type: 'text',
          text: 'The authoring revision is stale. Re-read the aggregate and reconcile your operations.',
        }])
        expect(fixture.current()).toMatchObject({
          tutor_source_note: 'Concurrent tutor correction',
          stem_text: { type: 'doc', content: [] },
        })

        const refreshed = await read()
        expect(refreshed.isError).not.toBe(true)
        expect(refreshed.structuredContent?.revision).not.toBe(originalRevision)
        expect(refreshed.structuredContent?.tutor_source_note)
          .toBe('Concurrent tutor correction')
        // Reconcile explicitly: update only the requested stem text, preserving
        // the other caller's source note returned by the fresh aggregate read.
        const recovered = await change(refreshed.structuredContent?.revision, {
          stemText: 'Requested correction',
        })
        expect(recovered.isError).not.toBe(true)
        expect(recovered.structuredContent).toMatchObject({
          effect: 'applied',
          aggregate: {
            status: 'draft',
            tutor_source_note: 'Concurrent tutor correction',
            stem_text: {
              type: 'doc',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Requested correction' }] }],
            },
          },
        })
        const finalRead = await read()
        expect(finalRead.structuredContent).toEqual(recovered.structuredContent?.aggregate)
        expect(finalRead.structuredContent?.revision)
          .not.toBe(refreshed.structuredContent?.revision)

        // A later success must not make the discarded revision valid again.
        const laterStale = await change(originalRevision, { stemText: 'Discarded correction' })
        expect(laterStale.isError).toBe(true)
        expect((await read()).structuredContent).toEqual(finalRead.structuredContent)
        expect(fixture.rpc).toHaveBeenLastCalledWith(
          'tutor_ucat_mcp_upsert_question_stem_bundle',
          expect.objectContaining({ p_expected_updated_at: original.structuredContent?.updated_at }),
        )
      } finally {
        await connection.close()
      }
    },
  )
})
