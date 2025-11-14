'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSendMessage } from '../api/mutations';
import { MessageTemplatesPicker } from './MessageTemplatesPicker';
import { replaceVariables } from '../utils/variableReplacer';
import { getStudentClasses } from '../api/bulk';
import { messagesKeys } from '../api/queryKeys';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import type { Tables, Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

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
  const { data: currentStaff } = useCurrentStaff();

  // Fetch conversation data to get student/parent info for variable replacement
  const { data: conversationData } = useQuery({
    queryKey: conversationId ? messagesKeys.conversationInfo(conversationId) : ['conversation-for-template'],
    queryFn: async () => {
      if (!conversationId) return null;
      
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          contacts (
            id,
            contact_type,
            students (id, first_name, last_name),
            parents (
              id,
              first_name,
              last_name,
              parents_students (
                students (id, first_name, last_name)
              )
            )
          )
        `)
        .eq('id', conversationId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!conversationId,
  });

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
  const handleTemplateSelect = async (template: Tables<'message_templates'>) => {
    let content = template.content;
    
    // Get sender name from current staff
    const senderName = currentStaff 
      ? `${currentStaff.first_name || ''} ${currentStaff.last_name || ''}`.trim() 
      : null;
    
    // Try to replace variables if we have conversation data
    if (conversationData?.contacts) {
      const contact = conversationData.contacts;
      
      // Check if it's a student contact
      if (contact.contact_type === 'STUDENT' && contact.students) {
        const student = contact.students as Tables<'students'>;
        try {
          // Fetch student classes
          const classes = await getStudentClasses(student.id);
          // Replace variables with actual data
          content = replaceVariables(template.content, student, classes, senderName);
        } catch (error) {
          console.error('Error fetching student classes for template:', error);
          // Fall back to template with placeholders if we can't fetch classes
        }
      }
      // Check if it's a parent contact - use their first student
      else if (contact.contact_type === 'PARENT' && contact.parents) {
        const parent = contact.parents as any;
        const parentStudents = parent.parents_students || [];
        if (parentStudents.length > 0) {
          const firstStudent = parentStudents[0]?.students;
          if (firstStudent) {
            const student = firstStudent as Tables<'students'>;
            try {
              // Fetch student classes
              const classes = await getStudentClasses(student.id);
              // Replace variables with actual data
              content = replaceVariables(template.content, student, classes, senderName);
            } catch (error) {
              console.error('Error fetching student classes for template:', error);
              // Fall back to template with placeholders if we can't fetch classes
            }
          }
        }
      }
    }
    
    setText(content);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className="border-t p-2 dark:border-brand-dark-border flex-shrink-0">
      <div className="flex items-start gap-2">
        <MessageTemplatesPicker 
          onSelect={handleTemplateSelect}
          disabled={send.isPending}
        />
        <textarea
          ref={textareaRef}
          className="flex-1 text-sm px-3 py-2 border rounded-md bg-background resize-none min-h-[44px] max-h-[200px]"
          placeholder="Message"
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


