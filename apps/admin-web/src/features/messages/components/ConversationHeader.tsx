'use client';

interface Props {
  title?: string;
}

export function ConversationHeader({ title }: Props) {
  return (
    <div className="px-6 py-3 border-b dark:border-brand-dark-border flex items-center justify-between">
      <div className="font-medium">{title || 'Conversation'}</div>
      <div className="text-sm text-muted-foreground">Actions coming soon</div>
    </div>
  );
}


