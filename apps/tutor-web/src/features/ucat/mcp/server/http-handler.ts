import type { McpServerOptions } from '@modelcontextprotocol/server'
import { withMcpRequestBodyLimit } from '@altitutor/shared/mcp/server'
import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import { verifyUcatMcpToken } from '@/features/ucat/mcp/server/auth'
import { registerUcatMcpTools } from '@/features/ucat/mcp/server/register-tools'

const instructions =
  'Altitutor UCAT authoring. Read content and reference data across every lifecycle. Create drafts and change content through aggregate-specific change tools: draft or in-review changes apply immediately, while published or live changes return a pending changeId that must be passed to apply_ucat_content_changes. Never publish, unpublish, hard-delete, or delete published content. Re-read before mutation and pass the latest opaque revision. Use explicit typed operations; omission never removes nested content. Audit runs apply valid changes by default only to their frozen targets while active; choose proposal_only when staff review is required. Every applied published edit is durably recorded and recoverable.'

export function createUcatMcpHttpHandler() {
  const serverOptions: Pick<McpServerOptions, 'maxToolInputElements'> = {
    // Covers 100 question-set operations with up to 500 stem IDs each.
    maxToolInputElements: 100_000,
  }
  const mcpHandler = createMcpHandler(
    (server) => {
      registerUcatMcpTools(server)
    },
    {
      ...serverOptions,
      serverInfo: {
        name: 'altitutor-ucat-authoring',
        version: '1.0.0',
      },
      instructions,
      capabilities: {
        tools: {},
      },
      maxSubscriptions: 0,
      verboseLogs: process.env.NODE_ENV === 'development',
    },
  )

  return withMcpAuth(withMcpRequestBodyLimit(mcpHandler), verifyUcatMcpToken, {
    required: true,
    resourceMetadataPath: '/.well-known/oauth-protected-resource',
  })
}
