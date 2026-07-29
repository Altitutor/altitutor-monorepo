import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import { verifyUcatMcpToken } from '@/features/ucat/mcp/server/auth'
import {
  registerUcatMcpTools,
  type UcatMcpProfile,
} from '@/features/ucat/mcp/server/register-tools'

const profileConfiguration: Record<
  UcatMcpProfile,
  { name: string; endpoint: string; instructions: string }
> = {
  authoring: {
    name: 'altitutor-ucat-authoring',
    endpoint: '/api/mcp',
    instructions:
      'Altitutor UCAT safe authoring. Read authoring content and reference data freely. Create drafts; edit only draft or in-review content; and submit ready drafts for review. Never edit published content or attempt to publish. Soft-delete or restore only draft or in-review top-level aggregates through the dedicated tools. Re-read an aggregate before updating, deleting, or restoring it and pass its latest opaque revision. Use explicit typed operations; omission never removes nested content. Generated images are previews until explicitly inserted with an update operation.',
  },
  'production-maintenance': {
    name: 'altitutor-ucat-production-maintenance',
    endpoint: '/api/mcp-production',
    instructions:
      'Altitutor UCAT production maintenance. You may edit published content through the dedicated exact-revision published-update tools. Use a direct update for a deliberate interactive edit; use a proposal when a staged or separately reviewable change is useful. A proposal does not require human review: an authorised agent may inspect and apply it through apply_ucat_content_changes, including a one-item batch. Never publish, unpublish, soft-delete, restore, or otherwise change content lifecycle state. Re-read the aggregate immediately before mutation and pass its latest opaque revision. For unattended audits, respect the audit run published-write mode and target manifest. Use explicit typed operations; omission never removes nested content. Every applied published edit remains durably recorded and recoverable.',
  },
}

export function createUcatMcpHttpHandler(profile: UcatMcpProfile) {
  const configuration = profileConfiguration[profile]
  const mcpHandler = createMcpHandler(
    (server) => {
      registerUcatMcpTools(server, { profile })
    },
    {
      serverInfo: {
        name: configuration.name,
        version: '1.0.0',
      },
      instructions: configuration.instructions,
      capabilities: {
        tools: {},
      },
    },
    {
      streamableHttpEndpoint: configuration.endpoint,
      disableSse: true,
      maxDuration: 300,
      verboseLogs: process.env.NODE_ENV === 'development',
    },
  )

  return withMcpAuth(
    mcpHandler,
    verifyUcatMcpToken,
    {
      required: true,
      resourceMetadataPath: '/.well-known/oauth-protected-resource',
    },
  )
}
