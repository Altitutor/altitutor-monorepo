'use client';

import { useState, useRef, useEffect } from 'react';
import { useSendMessage } from '../api/mutations';

interface Props {
  conversationId: string;
  onTyping?: () => void;
}

export function Composer({ conversationId, onTyping }: Props) {
  const [text, setText] = useState('');
  const send = useSendMessage();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-expand textarea as user types
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [text]);
  
  const handleTextChange = (newText: string) => {
    setText(newText);
    if (onTyping) onTyping();
  };

  const onSend = async () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    try {
      await send.mutateAsync({ conversationId, body });
    } catch (e) {
      console.error(e);
      setText(body);
    }
  };
  return (
    <div className="border-t p-2 dark:border-brand-dark-border">
      <div className="flex items-start gap-2">
        <textarea
          ref={textareaRef}
          className="flex-1 text-sm px-3 py-2 border rounded-md bg-background resize-none min-h-[44px] max-h-[200px]"
          placeholder="Type a message..."
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          rows={1}
        />
        <button
          className="px-3 py-2 text-sm rounded-md bg-brand-lightBlue text-brand-dark-bg hover:opacity-90 shrink-0"
          onClick={onSend}
          disabled={send.isPending}
        >
          Send
        </button>
      </div>
    </div>
  );
}


