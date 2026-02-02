'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { ScrollArea, Badge } from '@altitutor/ui';
import { replaceVariables } from '../../utils/variableReplacer';
import { getStudentClasses } from '../../api/bulk';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import type { Tables } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Sender } from '../../api/queries';
import { generateLinkTokensForStudent, templateContainsLinkVariables } from '../../utils/generateLinkTokens';
import type { AttachmentFile } from '../../hooks/useMessageAttachments';
import { MessageAttachment } from '../MessageThread';

interface Recipient {
  id: string;
  type: 'student' | 'parent';
  name: string;
  phone: string | null;
  studentId?: string; // For parents, reference to their student
}

interface MessagePreviewProps {
  students: Tables<'students'>[];
  message: string;
  sendToParents: boolean;
  selectedSender: Sender | null;
  attachments?: AttachmentFile[];
  onSend: () => void;
  onBack: () => void;
  isSending?: boolean;
}

export function MessagePreview({
  students,
  message,
  sendToParents,
  selectedSender,
  attachments = [],
  onSend: _onSend,
  onBack: _onBack,
  isSending: _isSending = false,
}: MessagePreviewProps) {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [studentClasses, setStudentClasses] = useState<
    Record<string, Array<{ class: Tables<'classes'>; subject: Tables<'subjects'> | null }>>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const { data: currentStaff } = useCurrentStaff();

  // Load all recipients and their classes
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      
      try {
        const allRecipients: Recipient[] = [];
        const classesMap: Record<string, Array<{ class: Tables<'classes'>; subject: Tables<'subjects'> | null }>> = {};

        // Add students as recipients
        for (const student of students) {
          allRecipients.push({
            id: student.id,
            type: 'student',
            name: `${student.first_name} ${student.last_name}`,
            phone: student.phone,
          });

          // Load student classes
          const classes = await getStudentClasses(student.id);
          classesMap[student.id] = classes;
        }

        // Add parents if requested
        if (sendToParents) {
          const studentIds = students.map(s => s.id);
          const { data: parentStudents, error } = await supabase
            .from('parents_students')
            .select(`
              parent_id,
              student_id,
              parents (
                id,
                first_name,
                last_name,
                phone
              )
            `)
            .in('student_id', studentIds);

          if (error) {
            console.error('Error fetching parents:', error);
          } else {
            (parentStudents || []).forEach((ps: any) => {
              if (ps.parents) {
                allRecipients.push({
                  id: `parent-${ps.parent_id}`,
                  type: 'parent',
                  name: `${ps.parents.first_name} ${ps.parents.last_name}`,
                  phone: ps.parents.phone,
                  studentId: ps.student_id,
                });
              }
            });
          }
        }

        setRecipients(allRecipients);
        setStudentClasses(classesMap);
        
        // Select first recipient
        if (allRecipients.length > 0) {
          setSelectedRecipientId(allRecipients[0].id);
        }
      } catch (error) {
        console.error('Error loading preview data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [students, sendToParents]);

  const recipientsWithPhone = recipients.filter(r => r.phone);

  const selectedRecipient = recipients.find(r => r.id === selectedRecipientId);

  // Get preview message for selected recipient
  const getPreviewMessage = () => {
    if (!selectedRecipient) return message;

    // For parents, use their student's data
    const studentId = selectedRecipient.type === 'parent' 
      ? selectedRecipient.studentId 
      : selectedRecipient.id;

    const student = students.find(s => s.id === studentId);
    if (!student || !studentId) return message;

    const senderName = currentStaff 
      ? `${currentStaff.first_name || ''} ${currentStaff.last_name || ''}`.trim() 
      : null;

    const classes = studentClasses[studentId] || [];
    
    // Note: Link tokens are not generated in preview to avoid unnecessary API calls
    // They will be generated when actually sending
    // Replace variables (link variables will be empty strings)
    let previewText = replaceVariables(message, student, classes, senderName);
    
    // Add placeholder text for link variables in preview
    previewText = previewText.replace(/\{registration_link\}/gi, '[Registration Link]');
    previewText = previewText.replace(/\{invite_link\}/gi, '[Invite Link]');
    previewText = previewText.replace(/\{forgot_password_link\}/gi, '[Forgot Password Link]');
    
    return previewText;
  };

  const getSenderDisplayName = (sender: Sender | null): string => {
    if (!sender) return 'Unknown';
    if (sender.sender_type === 'ALPHANUMERIC') {
      return sender.alphanumeric_sender_id || sender.label || 'Unknown';
    }
    return sender.label || sender.phone_e164 || 'Unknown';
  };

  return (
    <div className="h-full flex flex-col">
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading recipients...</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-2 gap-6 overflow-hidden min-h-0">
          {/* Recipients List */}
          <div className="flex flex-col min-h-0">
            <h3 className="font-semibold text-sm mb-3">Recipients ({recipientsWithPhone.length} / {recipients.length})</h3>
            <ScrollArea className="flex-1 border rounded-lg">
              <div className="p-2">
                {recipients.map((recipient) => (
                  <button
                    key={recipient.id}
                    onClick={() => setSelectedRecipientId(recipient.id)}
                    className={`w-full text-left p-3 rounded-md transition-colors ${
                      selectedRecipientId === recipient.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    } ${!recipient.phone ? 'opacity-50' : ''}`}
                    disabled={!recipient.phone}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{recipient.name}</div>
                        <div className="text-xs mt-0.5">
                          {recipient.type === 'parent' ? 'Parent' : 'Student'}
                          {!recipient.phone && ' • No phone'}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Message Preview */}
          <div className="flex flex-col min-h-0">
            {selectedRecipient ? (
              <>
                <div className="mb-3">
                  <h3 className="font-semibold text-sm">{selectedRecipient.name}</h3>
                  <div className="text-xs text-muted-foreground">
                    {selectedRecipient.phone || 'No phone number'}
                  </div>
                </div>
                <div className="flex flex-col flex-1 overflow-hidden border rounded-lg bg-muted/30 min-h-0">
                  <ScrollArea className="flex-1 p-4">
                    <div className="flex flex-col items-end gap-2">
                      {/* Sender badge */}
                      {selectedSender && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                          From: {selectedSender.sender_type === 'ALPHANUMERIC' 
                            ? (selectedSender.alphanumeric_sender_id || selectedSender.label || 'Unknown')
                            : (selectedSender.phone_e164 || selectedSender.label || 'Unknown')}
                        </Badge>
                      )}
                      {/* Attachments */}
                      {attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 max-w-[80%]">
                          {attachments.map((attachment) => {
                            // Convert AttachmentFile to message attachment format
                            const messageAttachment = {
                              id: attachment.id,
                              filename: attachment.file.name,
                              mime_type: attachment.file.type,
                              size_bytes: attachment.file.size,
                              storage_url: attachment.storageUrl || attachment.preview || '',
                            };
                            return (
                              <MessageAttachment
                                key={attachment.id}
                                attachment={messageAttachment}
                                direction="OUTBOUND"
                              />
                            );
                          })}
                        </div>
                      )}
                      {/* Message bubble */}
                      <div className={`max-w-[80%] rounded-lg px-4 py-2 text-white ${
                        selectedSender?.provider === 'TWILIO'
                          ? 'bg-[#30D158] dark:bg-[#1E8E3E]'
                          : selectedSender?.provider === 'IMESSAGE'
                          ? 'bg-[#007AFF] dark:bg-[#0A84FF]'
                          : 'bg-brand-lightBlue text-brand-dark-bg'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {getPreviewMessage()}
                        </p>
                      </div>
                    </div>
                  </ScrollArea>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                Select a recipient to preview their message
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}



