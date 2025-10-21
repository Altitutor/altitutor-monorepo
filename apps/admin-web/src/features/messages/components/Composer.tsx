'use client';

import { useState } from 'react';

interface Props {
  conversationId: string;
}

export function Composer({ conversationId }: Props) {
  const [text, setText] = useState('');
  const onSend = () => {
    if (!text.trim()) return;
    // TODO: integrate send mutation
    setText('');
  };
  return (
    <div className="border-t p-2 dark:border-brand-dark-border">
      <div className="flex items-center gap-2">
        <textarea
          className="flex-1 text-sm px-3 py-2 border rounded-md bg-background resize-none h-[44px]"
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          className="px-3 py-2 text-sm rounded-md bg-brand-lightBlue text-brand-dark-bg hover:opacity-90"
          onClick={onSend}
        >
          Send
        </button>
      </div>
    </div>
  );
}


