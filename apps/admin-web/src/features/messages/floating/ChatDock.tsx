'use client';

import { usePathname } from 'next/navigation';
import { useChatStore } from '../state/chatStore';
import { ChatWindow } from './ChatWindow';

export function ChatDock() {
  const pathname = usePathname();
  const windows = useChatStore(s => s.windows);

  const isMessagesPage = pathname?.startsWith('/admin/dashboard/communications');
  if (isMessagesPage) return null;

  if (!windows.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex gap-3 flex-wrap justify-end">
      {windows.map(w => (
        <ChatWindow key={w.conversationId} descriptor={w} />
      ))}
    </div>
  );
}


