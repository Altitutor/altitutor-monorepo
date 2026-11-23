import 'server-only';
import { tool, type ToolSet } from 'ai';
import { defineAdminTools } from '@/features/admin-mcp/server/register-tools';
import type { getAdminAiClient } from './settings';

export function adminChatTools(client: NonNullable<Awaited<ReturnType<typeof getAdminAiClient>>>) {
  const tools: ToolSet = {};
  defineAdminTools((name, definition, execute) => {
    if (!definition.annotations.readOnlyHint) return;
    tools[name] = tool({
      description: name === 'read_admin_file'
        ? 'Retrieve authorized file metadata. Open the file in Altitutor to view its content.'
        : definition.description,
      inputSchema: definition.inputSchema,
      async execute(input, { abortSignal }) {
        const { data, error } = await client.rpc('is_adminstaff_active');
        if (error || data !== true) throw new Error('Administrator access required.');
        const result = await execute(definition.inputSchema.parse(input), { userClient: () => client, signal: abortSignal, includeFileDownloadUrl: false });
        if (result.isError) throw new Error('The Altitutor tool could not complete this request.');
        const output = result.structuredContent ?? result.content;
        if (JSON.stringify(output).length > 24000) {
          return { error: 'The result is too large for chat. Narrow the query or request an aggregate.' };
        }
        return output;
      },
    });
  });
  return tools;
}
