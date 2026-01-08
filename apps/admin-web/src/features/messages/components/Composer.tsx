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
import { useAvailableSenders, type Sender } from '../api/queries';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';
import type { Tables, Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

interface Props {
  contactId: string | null;
  onTyping?: () => void;
  onBeforeSend?: (messageBody: string, selectedSenderId: string) => Promise<string | null>;
}

export function Composer({ contactId, onTyping, onBeforeSend }: Props) {
  const [text, setText] = useState('');
  const [selectedSenderId, setSelectedSenderId] = useState<string | null>(null);
  const send = useSendMessage();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { data: currentStaff } = useCurrentStaff();
  const { data: availableSenders, isLoading: isLoadingSenders } = useAvailableSenders();
  
  // Set default sender when senders load
  useEffect(() => {
    if (availableSenders && availableSenders.length > 0 && !selectedSenderId) {
      const defaultSender = availableSenders.find(s => s.is_default) || availableSenders[0];
      setSelectedSenderId(defaultSender.id);
    }
  }, [availableSenders, selectedSenderId]);

  // Fetch contact data to get student/parent info for variable replacement
  const { data: contactData } = useQuery({
    queryKey: contactId ? ['contact-for-template', contactId] : ['contact-for-template'],
    queryFn: async () => {
      if (!contactId) return null;
      
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      const { data, error } = await supabase
        .from('contacts')
        .select(`
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
        `)
        .eq('id', contactId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!contactId,
  });

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
    if (!body || !contactId || !selectedSenderId) return;
    setText('');
    
    try {
      // Call onBeforeSend if provided (for backward compatibility)
      if (onBeforeSend) {
        await onBeforeSend(body, selectedSenderId);
      }
      
      await send.mutateAsync({ 
        contactId, 
        body,
        selectedSenderId 
      });
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
    
    // Try to replace variables if we have contact data
    if (contactData) {
      const contact = contactData;
      
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

  const getSenderDisplayName = (sender: Sender | undefined): string => {
    if (!sender) return 'Select sender';
    if (sender.sender_type === 'ALPHANUMERIC') {
      return sender.alphanumeric_sender_id || sender.label || 'Unknown';
    }
    return sender.phone_e164 || sender.label || 'Unknown';
  };

  const getSenderDisplayForSelect = (sender: Sender | undefined): string => {
    if (!sender) return 'Select sender';
    if (sender.sender_type === 'ALPHANUMERIC') {
      return `From: ${sender.alphanumeric_sender_id || sender.label || 'Unknown'}`;
    }
    return `From: ${sender.phone_e164 || sender.label || 'Unknown'}`;
  };

  return (
    <div className="border-t p-2 dark:border-brand-dark-border flex-shrink-0">
      {/* Sender selector */}
      {contactId && availableSenders && availableSenders.length > 0 && (
        <div className="mb-2">
          <Select value={selectedSenderId || ''} onValueChange={setSelectedSenderId}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select sender">
                {selectedSenderId && getSenderDisplayForSelect(availableSenders.find(s => s.id === selectedSenderId))}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {availableSenders.map((sender) => (
                <SelectItem key={sender.id} value={sender.id}>
                  {getSenderDisplayForSelect(sender)}
                  {sender.is_default && ' (Default)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex items-start gap-2">
        <MessageTemplatesPicker 
          onSelect={handleTemplateSelect}
          disabled={send.isPending || !contactId || !selectedSenderId}
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
          disabled={!contactId || !selectedSenderId}
        />
        <button
          className="px-3 py-2 text-sm rounded-md bg-brand-lightBlue text-brand-dark-bg hover:opacity-90 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onSend}
          disabled={send.isPending || !contactId || !selectedSenderId || !text.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}


