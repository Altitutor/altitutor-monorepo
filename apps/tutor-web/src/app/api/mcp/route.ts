import { createUcatMcpHttpHandler } from '@/features/ucat/mcp/server/http-handler'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

const authenticatedHandler = createUcatMcpHttpHandler()

export {
  authenticatedHandler as DELETE,
  authenticatedHandler as GET,
  authenticatedHandler as POST,
}
