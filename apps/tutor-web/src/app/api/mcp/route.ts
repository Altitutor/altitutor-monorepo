import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import { registerUcatMcpTools } from '@/features/ucat/mcp/server/register-tools'
import { verifyUcatMcpToken } from '@/features/ucat/mcp/server/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

const mcpHandler = createMcpHandler(
  (server) => {
    registerUcatMcpTools(server)
  },
  {
    serverInfo: {
      name: 'altitutor-ucat-authoring',
      version: '1.0.0',
    },
    instructions:
      'Altitutor UCAT authoring only. Read learning modules, question-stem bundles, sets, mocks, and their authoring references freely. Create drafts and edit only draft or in-review content. Never attempt to publish or edit published content. Soft-delete or restore only draft or in-review top-level aggregates through the dedicated tools. Re-read an aggregate before updating, deleting, or restoring it and pass its latest opaque revision. Use explicit typed operations; omission never removes nested content. Generated images are previews until explicitly inserted with an update operation.',
    capabilities: {
      tools: {},
    },
  },
  {
    basePath: '/api',
    disableSse: true,
    maxDuration,
    verboseLogs: process.env.NODE_ENV === 'development',
  },
)

const authenticatedHandler = withMcpAuth(
  mcpHandler,
  verifyUcatMcpToken,
  {
    required: true,
    resourceMetadataPath: '/.well-known/oauth-protected-resource',
  },
)

export {
  authenticatedHandler as DELETE,
  authenticatedHandler as GET,
  authenticatedHandler as POST,
}
