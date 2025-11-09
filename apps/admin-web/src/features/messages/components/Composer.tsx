'use client';

import { useState, useRef, useEffect } from 'react';
import { useSendMessage } from '../api/mutations';
import { MessageTemplatesPicker } from './MessageTemplatesPicker';
import type { Tables } from '@altitutor/shared';

interface Props {
  conversationId: string | null;
  onTyping?: () => void;
  onBeforeSend?: (messageBody: string) => Promise<string | null>;
}

export function Composer({ conversationId: initialConversationId, onTyping, onBeforeSend }: Props) {
  const [text, setText] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  const send = useSendMessage();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update conversationId if prop changes
  useEffect(() => {
    setConversationId(initialConversationId);
  }, [initialConversationId]);

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
      // If no conversation yet, create it first via onBeforeSend
      let targetConvId = conversationId;
      if (!targetConvId && onBeforeSend) {
        targetConvId = await onBeforeSend(body);
        if (targetConvId) {
          setConversationId(targetConvId);
        }
      }
      
      if (!targetConvId) {
        setText(body);
        console.error('[Composer] No conversation ID available');
        return;
      }
      
      await send.mutateAsync({ conversationId: targetConvId, body });
    } catch (e) {
      console.error(e);
      setText(body);
    }
  };
  const handleTemplateSelect = (template: Tables<'message_templates'>) => {
    setText(template.content);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className="border-t p-2 dark:border-brand-dark-border">
      <div className="flex items-start gap-2">
        <MessageTemplatesPicker 
          onSelect={handleTemplateSelect}
          disabled={send.isPending}
        />
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


