'use client';

interface Props {
  conversationId: string;
}

export function MessageThread({ conversationId }: Props) {
  return (
    <div className="flex-1 overflow-y-auto p-3">
      <div className="text-xs text-muted-foreground">Conversation: {conversationId}</div>
    </div>
  );
}


