'use client';

import { useState, useRef, useEffect } from 'react';
import { useSendMessage } from '../api/mutations';
import { MessageTemplatesPicker } from './MessageTemplatesPicker';
import { replaceVariables } from '../utils/variableReplacer';
import { replaceVariablesForStaff } from '../utils/variableReplacerStaff';
import { getStudentClasses } from '../api/bulk';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { useAvailableSenders, useContactForTemplate, type Sender } from '../api/queries';
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import { generateLinkTokensForStudent, generateLinkTokensForStaff, templateContainsLinkVariables } from '../utils/generateLinkTokens';
import { Loader2, Paperclip, Phone, Check } from 'lucide-react';
import { useMessageAttachments } from '../hooks/useMessageAttachments';
import { AttachmentPreviewList } from './AttachmentPreview';
import { calculateSMSSegments } from '../utils/smsSegments';
import { useResponsiveButtons } from '../hooks/useResponsiveButtons';

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
    } catch (error: any) {
      alert(error?.message || 'Failed to add files');
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
      } catch (error: any) {
        alert(error?.message || 'Failed to add files');
      }
    }
  };

  // Fetch contact data to get student/parent info for variable replacement
  const { data: contactData } = useContactForTemplate(contactId);

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
          content = replaceVariables(template.content, student, classes, senderName, linkTokens || undefined);
        } catch (error) {
          console.error('Error fetching student classes for template:', error);
          // Fall back to template with placeholders if we can't fetch classes
        } finally {
          setIsGeneratingTokens(false);
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
              content = replaceVariables(template.content, student, classes, senderName, linkTokens || undefined);
            } catch (error) {
              console.error('Error fetching student classes for template:', error);
              // Fall back to template with placeholders if we can't fetch classes
            } finally {
              setIsGeneratingTokens(false);
            }
          }
        }
      }
      // Check if it's a staff contact
      else if (contact.contact_type === 'STAFF' && contact.staff) {
        const staff = contact.staff as Tables<'staff'>;
        try {
          setIsGeneratingTokens(needsLinks);
          
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
          
          // Replace variables with actual data (staff don't have classes)
          content = replaceVariablesForStaff(template.content, staff, senderName, linkTokens || undefined);
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


  const getSenderDisplayName = (sender: Sender | undefined): string => {
    if (!sender) return 'Select sender';
    if (sender.sender_type === 'ALPHANUMERIC') {
      return sender.alphanumeric_sender_id || sender.label || 'Unknown';
    }
    return sender.phone_e164 || sender.label || 'Unknown';
  };

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
            
            {/* Sender selector */}
            {contactId && availableSenders && availableSenders.length > 0 && (
              <div className="flex-shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    {canExpand ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={send.isPending || !contactId}
                        type="button"
                        className="h-10"
                      >
                        <Phone 
                          className={`h-4 w-4 mr-2 ${
                            selectedSender?.provider === 'IMESSAGE' 
                              ? 'text-[#007AFF] dark:text-[#0A84FF]' 
                              : selectedSender?.provider === 'TWILIO'
                              ? 'text-[#30D158] dark:text-[#1E8E3E]'
                              : ''
                          }`}
                        />
                        {selectedSender ? getSenderDisplayName(selectedSender) : 'Phone'}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={send.isPending || !contactId}
                        type="button"
                        className="h-10"
                        aria-label="Select sender"
                      >
                        <Phone 
                          className={`h-4 w-4 ${
                            selectedSender?.provider === 'IMESSAGE' 
                              ? 'text-[#007AFF] dark:text-[#0A84FF]' 
                              : selectedSender?.provider === 'TWILIO'
                              ? 'text-[#30D158] dark:text-[#1E8E3E]'
                              : ''
                          }`}
                        />
                      </Button>
                    )}
                  </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {(() => {
                    // Group senders by provider
                    const imessageSenders = availableSenders.filter(s => s.provider === 'IMESSAGE');
                    const twilioSenders = availableSenders.filter(s => s.provider === 'TWILIO');
                    
                    return (
                      <>
                        {imessageSenders.length > 0 && (
                          <>
                            <DropdownMenuLabel>iMessage</DropdownMenuLabel>
                            {imessageSenders.map((sender) => (
                              <DropdownMenuItem
                                key={sender.id}
                                onClick={() => setSelectedSenderId(sender.id)}
                                className="flex items-center justify-between"
                              >
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium">
                                    {getSenderDisplayName(sender)}
                                  </span>
                                  {sender.is_default && (
                                    <span className="text-xs text-muted-foreground">Default</span>
                                  )}
                                </div>
                                {selectedSenderId === sender.id && (
                                  <Check className="h-4 w-4 ml-2" />
                                )}
                              </DropdownMenuItem>
                            ))}
                          </>
                        )}
                        {imessageSenders.length > 0 && twilioSenders.length > 0 && (
                          <DropdownMenuSeparator />
                        )}
                        {twilioSenders.length > 0 && (
                          <>
                            <DropdownMenuLabel>SMS</DropdownMenuLabel>
                            {twilioSenders.map((sender) => (
                              <DropdownMenuItem
                                key={sender.id}
                                onClick={() => setSelectedSenderId(sender.id)}
                                className="flex items-center justify-between"
                              >
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium">
                                    {getSenderDisplayName(sender)}
                                  </span>
                                  {sender.is_default && (
                                    <span className="text-xs text-muted-foreground">Default</span>
                                  )}
                                </div>
                                {selectedSenderId === sender.id && (
                                  <Check className="h-4 w-4 ml-2" />
                                )}
                              </DropdownMenuItem>
                            ))}
                          </>
                        )}
                      </>
                    );
                  })()}
                </DropdownMenuContent>
              </DropdownMenu>
              </div>
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


