import { createAdminMcpHttpHandler } from '@/features/admin-mcp/server/http-handler';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const handler = createAdminMcpHttpHandler();
export { handler as GET, handler as POST, handler as DELETE };
