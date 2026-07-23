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

const metadataHandler = protectedResourceHandler({
  authServerUrls: [authServerUrl()],
})
const corsHandler = metadataCorsOptionsRequestHandler()

export {
  metadataHandler as GET,
  corsHandler as OPTIONS,
}

