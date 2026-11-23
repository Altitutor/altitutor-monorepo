import { randomUUID } from 'node:crypto';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { AdminChat } from '@/features/admin-ai/components/AdminChat';
import { getAdminAiClient } from '@/features/admin-ai/server/settings';
import { getChatThread, listChatThreads } from '@/features/admin-ai/server/threads';

export default async function StaffChatPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string | string[] }>;
}) {
  const client = await getAdminAiClient();
  if (!client) notFound();
  const { thread } = await searchParams;
  const parsed = z.uuid().safeParse(thread);
  if (thread && !parsed.success) notFound();

  const [existing, threads] = await Promise.all([
    parsed.success ? getChatThread(client, parsed.data) : null,
    listChatThreads(client),
  ]);
  if (parsed.success && !existing) notFound();

  const id = existing?.id ?? randomUUID();
  return <AdminChat key={id} id={id} initialMessages={existing?.messages ?? []} threads={threads} />;
}
