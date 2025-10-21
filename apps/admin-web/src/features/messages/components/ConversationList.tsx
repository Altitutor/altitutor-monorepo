'use client';

export function ConversationList() {
  return (
    <div className="h-full border-r dark:border-brand-dark-border">
      <div className="p-3">
        <input className="w-full px-3 py-2 text-sm border rounded-md" placeholder="Search conversations" />
      </div>
      <div className="divide-y dark:divide-brand-dark-border">
        {/* Items will be rendered here */}
        <div className="p-3 text-sm text-muted-foreground">No conversations yet.</div>
      </div>
    </div>
  );
}


