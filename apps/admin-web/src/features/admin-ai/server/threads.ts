import 'server-only';
import { z } from 'zod';
import type { getAdminAiClient } from './settings';

type AdminClient = NonNullable<Awaited<ReturnType<typeof getAdminAiClient>>>;

export const chatMessage = z.object({
  id: z.string().min(1).max(100),
  role: z.enum(['user', 'assistant']),
  parts: z.array(z.object({
    type: z.literal('text'),
    text: z.string().max(16000),
  })).min(1).max(8),
});

type ChatMessage = z.infer<typeof chatMessage>;

export async function getChatThread(client: AdminClient, id: string) {
  const { data, error } = await client.from('admin_ai_chat_threads')
    .select('id, messages, updated_at').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const parsed = z.array(chatMessage).max(40).safeParse(data.messages);
  const messages = parsed.success && parsed.data.length % 2 === 0
    && parsed.data.every(({ role }, index) => role === (index % 2 === 0 ? 'user' : 'assistant'))
    ? parsed.data : [];
  return { ...data, messages };
}

export async function listChatThreads(client: AdminClient) {
  const { data, error } = await client.from('admin_ai_chat_threads')
    .select('id, title').order('updated_at', { ascending: false }).limit(30);
  if (error) throw error;
  return data;
}

export async function saveChatTurn(
  client: AdminClient,
  id: string,
  turn: [ChatMessage, ChatMessage],
  existing: Awaited<ReturnType<typeof getChatThread>>,
) {
  if (!existing) {
    const { error } = await client.from('admin_ai_chat_threads').insert({
      id,
      title: Array.from(turn[0].parts[0].text.trim()).slice(0, 100).join(''),
      messages: turn,
    });
    if (error) throw error;
    return;
  }
  const messages = [...existing.messages, ...turn].slice(-40);
  while (Buffer.byteLength(JSON.stringify(messages)) > 500000) messages.splice(0, 2);

  const { error } = await client.from('admin_ai_chat_threads')
    .update({
      messages,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('updated_at', existing.updated_at)
    .select('id')
    .single();
  if (error) throw error;
}

export function selectChatContext(messages: ChatMessage[]) {
  let remaining = 32000;
  let start = messages.length;
  while (start >= 2) {
    const turn = messages.slice(start - 2, start);
    remaining -= turn.flatMap(({ parts }) => parts).reduce((sum, { text }) => sum + text.length, 0);
    if (remaining < 0) break;
    start -= 2;
  }
  return messages.slice(start);
}
