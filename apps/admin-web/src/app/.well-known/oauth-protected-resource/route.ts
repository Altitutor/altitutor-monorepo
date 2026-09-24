import {
  metadataCorsOptionsRequestHandler,
  protectedResourceHandler,
} from 'mcp-handler'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function authServerUrl(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured')
  return `${supabaseUrl.replace(/\/$/u, '')}/auth/v1`
}

const corsHandler = metadataCorsOptionsRequestHandler()

/** Built per request so CI builds without Supabase env do not fail at module load. */
export function GET(req: Request): Response {
  return protectedResourceHandler({
    authServerUrls: [authServerUrl()],
  })(req)
}

export { corsHandler as OPTIONS }
