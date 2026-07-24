import { createHash } from 'node:crypto'
import type { Database, Json } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'

export type UcatMcpIdempotentTool =
  | 'create_learning_module'
  | 'create_question_stem'
  | 'create_question_set'
  | 'create_mock'
  | 'start_question_generation'
  | 'generate_ucat_image'
  | 'revise_ucat_image'

type RpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)]),
  )
}

export function ucatMcpRequestHash(toolName: UcatMcpIdempotentTool, request: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify({ toolName, request: canonicalize(request) }))
    .digest('hex')
}

function asJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json
}

function asRpcClient(client: SupabaseClient<Database>): RpcClient {
  return client as unknown as RpcClient
}

function stateOf(value: unknown): {
  state: 'execute' | 'running' | 'completed' | 'failed'
  result?: unknown
  error?: string
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Idempotency reservation returned an invalid result')
  }
  const record = value as Record<string, unknown>
  if (
    record.state !== 'execute'
    && record.state !== 'running'
    && record.state !== 'completed'
    && record.state !== 'failed'
  ) {
    throw new Error('Idempotency reservation returned an invalid state')
  }
  return {
    state: record.state,
    result: record.result,
    error: typeof record.error === 'string' ? record.error : undefined,
  }
}

export async function executeUcatMcpIdempotent<T>(
  client: SupabaseClient<Database>,
  toolName: UcatMcpIdempotentTool,
  idempotencyKey: string,
  request: unknown,
  operation: () => Promise<T>,
): Promise<T> {
  const requestHash = ucatMcpRequestHash(toolName, request)
  const rpc = asRpcClient(client)
  const reservation = await rpc.rpc('tutor_ucat_mcp_begin_idempotency', {
    p_tool_name: toolName,
    p_idempotency_key: idempotencyKey,
    p_request_hash: requestHash,
  })
  if (reservation.error) throw new Error(reservation.error.message)

  const state = stateOf(reservation.data)
  if (state.state === 'completed') return state.result as T
  if (state.state === 'running') {
    throw new Error(
      'An operation with this idempotency key is still running. Retry later with the same key.',
    )
  }
  if (state.state === 'failed') {
    throw new Error(
      `The original operation with this idempotency key failed: ${state.error ?? 'unknown error'}. `
      + 'Use a new key only after changing or reconciling the request.',
    )
  }

  try {
    const result = await operation()
    const completed = await rpc.rpc('tutor_ucat_mcp_complete_idempotency', {
      p_tool_name: toolName,
      p_idempotency_key: idempotencyKey,
      p_request_hash: requestHash,
      p_result: asJson(result),
    })
    if (completed.error) throw new Error(completed.error.message)
    return result
  } catch (error) {
    await rpc.rpc('tutor_ucat_mcp_fail_idempotency', {
      p_tool_name: toolName,
      p_idempotency_key: idempotencyKey,
      p_request_hash: requestHash,
      p_error_message: error instanceof Error ? error.message : 'UCAT MCP operation failed',
    })
    throw error
  }
}
