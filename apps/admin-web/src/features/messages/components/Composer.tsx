'use client';

import { useState, useRef, useEffect } from 'react';
import { useSendMessage } from '../api/mutations';
import { MessageTemplatesPicker } from './MessageTemplatesPicker';
import { replaceVariables } from '../utils/variableReplacer';
import { replaceVariablesForParent, type StudentWithClasses } from '../utils/variableReplacerParent';
import { replaceVariablesForStaff } from '../utils/variableReplacerStaff';
import { getStudentClasses, getStaffClasses } from '../api/bulk';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { useAvailableSenders, useContactForTemplate } from '../api/queries';
import { Button } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import { generateLinkTokensForStudent, generateLinkTokensForStaff, templateContainsLinkVariables } from '../utils/generateLinkTokens';
import { Loader2, Paperclip } from 'lucide-react';
import { useMessageAttachments } from '../hooks/useMessageAttachments';
import { AttachmentPreviewList } from './AttachmentPreview';
import { calculateSMSSegments } from '../utils/smsSegments';
import { useResponsiveButtons } from '../hooks/useResponsiveButtons';
import { useContactClasses } from '../hooks/useContactClasses';
import { useVariableReplacement } from '../hooks/useVariableReplacement';
import { ComposerVariablesDropdown } from './ComposerVariablesDropdown';
import { ComposerSenderSelector } from './ComposerSenderSelector';

interface Props {
  contactId: string | null;
  onTyping?: () => void;
  onBeforeSend?: (messageBody: string, selectedSenderId: string) => Promise<string | null>;
  draft?: string;
  onDraftChange?: (draft: string) => void;
  onDraftClear?: () => void;
}

export function Composer({ 
  contactId, 
  onTyping, 
  onBeforeSend,
  draft,
  onDraftChange,
  onDraftClear
}: Props) {
  // Use controlled draft if provided, otherwise fall back to internal state
  const [internalText, setInternalText] = useState('');
  const text = draft !== undefined ? draft : internalText;
  const setText = draft !== undefined && onDraftChange ? onDraftChange : setInternalText;
  
  const [selectedSenderId, setSelectedSenderId] = useState<string | null>(null);
  const [isGeneratingTokens, setIsGeneratingTokens] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [variablesMenuOpen, setVariablesMenuOpen] = useState(false);
  const send = useSendMessage();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRowRef = useRef<HTMLDivElement>(null);
  const { data: currentStaff } = useCurrentStaff();
  const { data: availableSenders } = useAvailableSenders();
  const canExpand = useResponsiveButtons(buttonRowRef);
  const {
    attachments,
    addFiles,
    removeAttachment,
    clearAll,
    getSuccessfulAttachments,
    hasAttachments,
    canAddMore,
  } = useMessageAttachments();
  
  // Set default sender when senders load
  useEffect(() => {
    if (availableSenders && availableSenders.length > 0 && !selectedSenderId) {
      const defaultSender = availableSenders.find(s => s.is_default) || availableSenders[0];
      setSelectedSenderId(defaultSender.id);
    }
  }, [availableSenders, selectedSenderId]);

  // Check if selected sender is iMessage
  const selectedSender = availableSenders?.find(s => s.id === selectedSenderId);
  const isIMessageSender = selectedSender?.provider === 'IMESSAGE';
  const isSMSSender = selectedSender?.provider === 'TWILIO';
  
  // Calculate SMS segments for SMS senders
  const smsSegments = isSMSSender ? calculateSMSSegments(text) : null;

  // Handle file selection
  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0 || !isIMessageSender) return;
    
    try {
      await addFiles(files);
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to add files');
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    if (!isIMessageSender) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!isIMessageSender) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (!isIMessageSender) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      try {
        await addFiles(files);
      } catch (error: unknown) {
        alert(error instanceof Error ? error.message : 'Failed to add files');
      }
    }
  };

  // Fetch contact data to get student/parent info for variable replacement
  const { data: contactData } = useContactForTemplate(contactId);

  // Fetch classes for students/staff to determine if class variables can be shown (React Query)
  const { studentHasClasses, staffHasClasses } = useContactClasses(contactData ?? null);

  // Variable replacement logic (extracted to hook)
  const { getVariableValue, getAvailableVariables, getParentStudents } = useVariableReplacement(
    contactData ?? null,
    studentHasClasses,
    staffHasClasses,
    currentStaff ?? undefined,
    setIsGeneratingTokens
  );

  // Auto-expand textarea as user types
  useEffect(() => {
    if (textareaRef.current) {
      // Reset height to auto to get accurate scrollHeight
      textareaRef.current.style.height = 'auto';
      // Get scrollHeight (includes padding)
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 200; // max-h-[200px]
      const newHeight = Math.min(scrollHeight, maxHeight);
      // Set height
      textareaRef.current.style.height = `${newHeight}px`;
      // Hide overflow when content fits, show scrollbar only when it exceeds max height
      textareaRef.current.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
  }, [text]);
  
  const handleTextChange = (newText: string) => {
    setText(newText);
    if (onTyping) onTyping();
  };

  const onSend = async () => {
    const body = text.trim();
    // Allow sending if there's text OR attachments (for iMessage, can send attachments without text)
    const hasContent = body || (isIMessageSender && hasAttachments);
    if (!hasContent || !contactId || !selectedSenderId) return;

    // Get successful attachments
    const successfulAttachments = getSuccessfulAttachments();
    
    // Don't send if there are failed uploads
    const hasFailedUploads = attachments.some(att => att.status === 'error');
    if (hasFailedUploads) {
      alert('Please remove failed uploads before sending');
      return;
    }

    // Don't send if there are still uploading files
    const hasUploadingFiles = attachments.some(att => att.status === 'uploading');
    if (hasUploadingFiles) {
      alert('Please wait for all files to finish uploading');
      return;
    }
    
    // Clear draft (either via callback or directly)
    if (onDraftClear) {
      onDraftClear();
    } else {
      setText('');
    }
    
    try {
      // Call onBeforeSend if provided (for backward compatibility)
      if (onBeforeSend) {
        await onBeforeSend(body, selectedSenderId);
      }
      
      await send.mutateAsync({ 
        contactId, 
        body: body || '', // Allow empty body if attachments exist
        selectedSenderId,
        attachments: successfulAttachments.map(att => ({
          storageUrl: att.storageUrl!,
          filename: att.file.name,
          mimeType: att.file.type,
          sizeBytes: att.file.size,
        })),
      });
      
      // Clear attachments after successful send
      clearAll();
    } catch (e) {
      console.error(e);
      // Restore draft on error
      setText(body);
    }
  };
  const handleTemplateSelect = async (template: Tables<'message_templates'>) => {
    let content = template.content;
    
    // Get sender name from current staff
    const senderName = currentStaff 
      ? `${currentStaff.first_name || ''} ${currentStaff.last_name || ''}`.trim() 
      : null;
    
    // Check if template contains link variables
    const needsLinks = templateContainsLinkVariables(template.content);
    
    // Try to replace variables if we have contact data
    if (contactData) {
      const contact = contactData;
      
      // Check if it's a student contact
      if (contact.contact_type === 'STUDENT' && contact.students) {
        const student = contact.students as Tables<'students'>;
        try {
          setIsGeneratingTokens(needsLinks);
          
          // Fetch student classes
          const classes = await getStudentClasses(student.id);
          
          // Generate link tokens if template contains link variables
          let linkTokens = null;
          if (needsLinks) {
            try {
              linkTokens = await generateLinkTokensForStudent(student.id, {
                includeRegistration: template.content.includes('{registration_link}'),
                includeInvite: template.content.includes('{invite_link}'),
                includePasswordReset: template.content.includes('{forgot_password_link}'),
              });
            } catch (error) {
              console.error('Error generating link tokens:', error);
              // Continue without tokens - variables will be replaced with empty strings
            }
          }
          
          // Replace variables with actual data
          content = await replaceVariables(template.content, student, classes, senderName, linkTokens || undefined);
        } catch (error) {
          console.error('Error fetching student classes for template:', error);
          // Fall back to template with placeholders if we can't fetch classes
        } finally {
          setIsGeneratingTokens(false);
        }
      }
      // Check if it's a parent contact - use all their students
      else if (contact.contact_type === 'PARENT' && contact.parents) {
        const parentData = contact.parents as any;
        const parent: Tables<'parents'> = {
          id: parentData.id,
          first_name: parentData.first_name || '',
          last_name: parentData.last_name || '',
          email: parentData.email || null,
          phone: parentData.phone || null,
          user_id: parentData.user_id || null,
          invite_token: parentData.invite_token || null,
          created_by: parentData.created_by || null,
          created_at: parentData.created_at || null,
          updated_at: parentData.updated_at || null,
        };
        const parentStudents = (contact.parents as any).parents_students || [];
        
        if (parentStudents.length > 0) {
          try {
            setIsGeneratingTokens(needsLinks);
            
            // Build students array with classes and link tokens
            const studentsWithClasses: StudentWithClasses[] = await Promise.all(
              parentStudents.map(async (ps: any) => {
                const student = ps.students as Tables<'students'>;
                if (!student) return null;

                const classes = await getStudentClasses(student.id);
                
                let linkTokens = null;
                if (needsLinks) {
                  try {
                    const tokens = await generateLinkTokensForStudent(student.id, {
                      includeRegistration: template.content.includes('{registration_link}'),
                      includeInvite: template.content.includes('{invite_link}'),
                      includePasswordReset: template.content.includes('{forgot_password_link}'),
                    });
                    linkTokens = tokens ? {
                      registrationToken: tokens.registrationToken || null,
                      inviteToken: tokens.inviteToken || null,
                      forgotPasswordLink: tokens.forgotPasswordLink || null,
                    } : null;
                  } catch (error) {
                    console.error('Error generating link tokens:', error);
                    // Continue without tokens
                  }
                }

                return {
                  student,
                  classes,
                  linkTokens,
                };
              })
            );

            // Filter out nulls and sort alphabetically by name (consistent with UI)
            const validStudents = studentsWithClasses
              .filter((s): s is StudentWithClasses => s !== null)
              .sort((a, b) => {
                const nameA = `${a.student.first_name || ''} ${a.student.last_name || ''}`.trim().toLowerCase();
                const nameB = `${b.student.first_name || ''} ${b.student.last_name || ''}`.trim().toLowerCase();
                return nameA.localeCompare(nameB);
              });
            
            // Replace variables with actual data (using parent replacer)
            content = await replaceVariablesForParent(template.content, parent, validStudents, senderName);
          } catch (error) {
            console.error('Error fetching student classes for template:', error);
            // Fall back to template with placeholders if we can't fetch classes
          } finally {
            setIsGeneratingTokens(false);
          }
        }
      }
      // Check if it's a staff contact
      else if (contact.contact_type === 'STAFF' && contact.staff) {
        const staff = contact.staff as Tables<'staff'>;
        try {
          setIsGeneratingTokens(needsLinks);
          
          // Fetch staff classes
          const classes = await getStaffClasses(staff.id);
          
          // Generate link tokens if template contains link variables
          let linkTokens = null;
          if (needsLinks) {
            try {
              linkTokens = await generateLinkTokensForStaff(staff.id, staff.role, {
                includeInvite: template.content.includes('{invite_link}'),
                includePasswordReset: template.content.includes('{forgot_password_link}'),
              });
            } catch (error) {
              console.error('Error generating link tokens for staff:', error);
              // Continue without tokens - variables will be replaced with empty strings
            }
          }
          
          // Replace variables with actual data
          content = await replaceVariablesForStaff(template.content, staff, classes, senderName, linkTokens || undefined);
        } catch (error) {
          console.error('Error processing staff template:', error);
        } finally {
          setIsGeneratingTokens(false);
        }
      }
    }
    
    setText(content);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Insert variable at cursor position and replace with actual value
  const handleInsertVariable = async (variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const textBefore = text.substring(0, start);
    const textAfter = text.substring(end);
    
    // Get the replacement value
    const replacementValue = await getVariableValue(variable);
    const newText = textBefore + replacementValue + textAfter;
    
    setText(newText);
    
    // Dismiss the dropdown
    setVariablesMenuOpen(false);
    
    // Restore cursor position after variable insertion
    setTimeout(() => {
      const newPosition = start + replacementValue.length;
      textarea.focus();
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const availableVariables = getAvailableVariables();
  const parentStudents = getParentStudents();

  return (
    <div ref={containerRef} className="border-t dark:border-brand-dark-border flex-shrink-0">
      {/* Attachment previews */}
      {hasAttachments && (
        <AttachmentPreviewList attachments={attachments} onRemove={removeAttachment} />
      )}
      
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
        accept="*/*"
      />
      
      <div 
        className={`flex flex-col gap-2 p-2 ${isDragging && isIMessageSender ? 'bg-muted/50' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Textarea row */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            className={`w-full text-sm px-3 py-2 border rounded-md bg-background resize-none min-h-[44px] max-h-[200px] ${
              isDragging && isIMessageSender ? 'border-primary border-2' : ''
            }`}
            placeholder={isIMessageSender ? "Message (or drag files here)" : "Message"}
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
              // For SMS, prevent line breaks (Shift+Enter does nothing)
              if (e.key === 'Enter' && e.shiftKey && !isIMessageSender) {
                e.preventDefault();
              }
            }}
            rows={1}
            disabled={!contactId || !selectedSenderId}
          />
          {/* SMS segment counter (bottom right of textarea) */}
          {isSMSSender && smsSegments && (
            <div className="absolute bottom-2 right-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{smsSegments.characters} chars</span>
              <span>•</span>
              <span>{smsSegments.segments} {smsSegments.segments === 1 ? 'segment' : 'segments'}</span>
            </div>
          )}
        </div>
        
        {/* Button row: template/attachments/phone on left, send on right */}
        <div ref={buttonRowRef} className="flex items-center justify-between gap-2 min-w-0">
          {/* Left side: Template, Attachments, Phone buttons */}
          <div className="flex items-center gap-2 flex-shrink min-w-0">
            {/* Template button */}
            <div className="relative flex-shrink-0">
              <MessageTemplatesPicker 
                onSelect={handleTemplateSelect}
                disabled={send.isPending || !contactId || !selectedSenderId || isGeneratingTokens}
                expanded={canExpand}
              />
              {isGeneratingTokens && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-md pointer-events-none">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
            
            <ComposerVariablesDropdown
              availableVariables={availableVariables}
              parentStudents={parentStudents}
              studentHasClasses={studentHasClasses}
              contactType={contactData?.contact_type}
              open={variablesMenuOpen}
              onOpenChange={setVariablesMenuOpen}
              onInsertVariable={handleInsertVariable}
              canExpand={canExpand}
              disabled={send.isPending || !contactId || !selectedSenderId}
            />
            
            {/* Upload button - only show for iMessage senders */}
            {isIMessageSender && canAddMore && (
              <div className="flex-shrink-0">
                {canExpand ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={send.isPending || !contactId || !selectedSenderId}
                    className="h-10"
                  >
                    <Paperclip className="h-4 w-4 mr-2" />
                    Attach
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={send.isPending || !contactId || !selectedSenderId}
                    className="h-10"
                    aria-label="Attach files"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
            
            {contactId && availableSenders && availableSenders.length > 0 && (
              <ComposerSenderSelector
                availableSenders={availableSenders}
                selectedSenderId={selectedSenderId}
                onSelectSender={setSelectedSenderId}
                canExpand={canExpand}
                disabled={send.isPending || !contactId}
              />
            )}
          </div>
          
          {/* Right side: Send button */}
          <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
            {send.isPending && (
              <span className="text-xs text-muted-foreground">Sending...</span>
            )}
            <button
              className={`px-4 py-2 text-sm rounded-md text-white hover:opacity-90 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed h-10 ${
                isIMessageSender
                  ? 'bg-[#007AFF] dark:bg-[#0A84FF]'
                  : isSMSSender
                  ? 'bg-[#30D158] dark:bg-[#1E8E3E]'
                  : 'bg-brand-lightBlue text-brand-dark-bg'
              }`}
              onClick={onSend}
              disabled={
                send.isPending || 
                !contactId || 
                !selectedSenderId || 
                (!text.trim() && !(isIMessageSender && hasAttachments))
              }
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


