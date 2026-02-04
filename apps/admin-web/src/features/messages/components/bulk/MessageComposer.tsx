'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Paperclip, Phone, Check, Code } from 'lucide-react';
import { Button, Textarea, ScrollArea, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@altitutor/ui';
import { MessageTemplatesPicker } from '../MessageTemplatesPicker';
import { replaceVariables } from '../../utils/variableReplacer';
import { getStudentClasses } from '../../api/bulk';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import type { Tables } from '@altitutor/shared';
import type { Sender } from '../../api/queries';
import { useMessageAttachments } from '../../hooks/useMessageAttachments';
import { calculateSMSSegments } from '../../utils/smsSegments';
import type { AttachmentFile } from '../../hooks/useMessageAttachments';
import { MessageAttachment } from '../MessageThread';

interface MessageComposerProps {
  students: Tables<'students'>[];
  message: string;
  onMessageChange: (message: string) => void;
  availableSenders: Sender[];
  selectedSenderId: string | null;
  onSenderChange: (senderId: string) => void;
  isLoadingSenders: boolean;
  attachments?: AttachmentFile[];
  onAttachmentsChange?: (attachments: AttachmentFile[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export function MessageComposer({
  students,
  message,
  onMessageChange,
  availableSenders,
  selectedSenderId,
  onSenderChange,
  isLoadingSenders,
  attachments: externalAttachments,
  onAttachmentsChange,
  onNext: _onNext,
  onBack: _onBack,
}: MessageComposerProps) {
  const [previewIndex, setPreviewIndex] = useState(0);
  const [studentClasses, setStudentClasses] = useState<
    Record<string, Array<{ class: Tables<'classes'>; subject: Tables<'subjects'> | null }>>
  >({});
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const { data: currentStaff } = useCurrentStaff();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [variablesMenuOpen, setVariablesMenuOpen] = useState(false);

  // Get selected sender info
  const selectedSender = availableSenders.find(s => s.id === selectedSenderId);
  const isIMessageSender = selectedSender?.provider === 'IMESSAGE';
  const isSMSSender = selectedSender?.provider === 'TWILIO';

  // Message attachments hook
  const {
    attachments: internalAttachments,
    addFiles,
    hasAttachments,
    canAddMore,
  } = useMessageAttachments();

  // Merge external attachments with internal ones
  // External attachments are persisted from parent, internal are newly added
  const attachments = useMemo(() => {
    if (!externalAttachments || externalAttachments.length === 0) {
      return internalAttachments;
    }
    // Merge: external attachments + any new internal attachments not in external
    const externalIds = new Set(externalAttachments.map(att => att.id));
    const newInternal = internalAttachments.filter(att => !externalIds.has(att.id));
    return [...externalAttachments, ...newInternal];
  }, [externalAttachments, internalAttachments]);

  // Sync only internal attachments to parent (to avoid infinite loop)
  // Track previous internal attachments to detect changes
  const prevInternalRef = useRef(internalAttachments);
  const externalAttachmentsRef = useRef(externalAttachments);
  const onAttachmentsChangeRef = useRef(onAttachmentsChange);
  
  // Keep refs up to date
  useEffect(() => {
    externalAttachmentsRef.current = externalAttachments;
    onAttachmentsChangeRef.current = onAttachmentsChange;
  }, [externalAttachments, onAttachmentsChange]);
  
  useEffect(() => {
    const onAttachmentsChange = onAttachmentsChangeRef.current;
    if (!onAttachmentsChange) return;
    
    // Check if internal attachments actually changed
    const hasChanged = 
      prevInternalRef.current.length !== internalAttachments.length ||
      prevInternalRef.current.some((att, idx) => {
        const newAtt = internalAttachments[idx];
        return !newAtt || att.id !== newAtt.id || att.status !== newAtt.status;
      });
    
    if (hasChanged) {
      prevInternalRef.current = internalAttachments;
      
      // Merge with external attachments before syncing
      const externalAttachments = externalAttachmentsRef.current;
      if (externalAttachments && externalAttachments.length > 0) {
        const externalIds = new Set(externalAttachments.map(att => att.id));
        const newInternal = internalAttachments.filter(att => !externalIds.has(att.id));
        onAttachmentsChange([...externalAttachments, ...newInternal]);
      } else {
        onAttachmentsChange(internalAttachments);
      }
    }
  }, [internalAttachments]); // Only depend on internalAttachments to avoid loop


  // Calculate SMS segments
  const smsSegments = isSMSSender ? calculateSMSSegments(message) : null;

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const currentStudent = students[previewIndex];

  // Load classes for current student
  useEffect(() => {
    if (!currentStudent) return;
    
    const loadClasses = async () => {
      if (studentClasses[currentStudent.id]) return; // Already loaded
      
      setIsLoadingClasses(true);
      try {
        const classes = await getStudentClasses(currentStudent.id);
        setStudentClasses(prev => ({
          ...prev,
          [currentStudent.id]: classes,
        }));
      } catch (error) {
        console.error('Error loading student classes:', error);
      } finally {
        setIsLoadingClasses(false);
      }
    };
    
    loadClasses();
  }, [currentStudent, studentClasses]);

  const handleTemplateSelect = (template: Tables<'message_templates'>) => {
    onMessageChange(template.content);
  };

  const senderName = currentStaff 
    ? `${currentStaff.first_name || ''} ${currentStaff.last_name || ''}`.trim() 
    : null;

  const previewMessage = currentStudent && studentClasses[currentStudent.id]
    ? replaceVariables(message, currentStudent, studentClasses[currentStudent.id] || [], senderName)
    : message;

  const handlePrevious = () => {
    setPreviewIndex(Math.max(0, previewIndex - 1));
  };

  const handleNext = () => {
    setPreviewIndex(Math.min(students.length - 1, previewIndex + 1));
  };

  const getSenderDisplayName = (sender: Sender): string => {
    if (sender.sender_type === 'ALPHANUMERIC') {
      return sender.alphanumeric_sender_id || sender.label || 'Unknown';
    }
    return sender.label || sender.phone_e164 || 'Unknown';
  };

  // File handling
  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    // Always use hook to add files (handles upload)
    // The useEffect will sync merged attachments to parent
    await addFiles(fileArray);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isIMessageSender) return;
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (!isIMessageSender) return;
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await handleFileSelect(files);
    }
  };

  // Insert variable at cursor position
  const handleInsertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const textBefore = message.substring(0, start);
    const textAfter = message.substring(end);
    const variableText = `{${variable}}`;
    const newMessage = textBefore + variableText + textAfter;
    
    onMessageChange(newMessage);
    
    // Dismiss the dropdown
    setVariablesMenuOpen(false);
    
    // Restore cursor position after variable insertion
    setTimeout(() => {
      const newPosition = start + variableText.length;
      textarea.focus();
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const variables = [
    { key: 'first_name', label: 'First name', description: "Student's first name" },
    { key: 'last_name', label: 'Last name', description: "Student's last name" },
    { key: 'classes', label: 'Classes', description: "Student's enrolled classes (formatted list)" },
    { key: 'sender_name', label: 'Sender name', description: 'Name of the currently logged in staff member' },
    { key: 'registration_link', label: 'Registration link', description: 'Registration link (students only)' },
    { key: 'invite_link', label: 'Invite link', description: 'Invite link (students or staff)' },
    { key: 'forgot_password_link', label: 'Forgot password link', description: 'Password reset link (students or staff)' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-6 overflow-hidden">
        {/* Message Input */}
        <div className="flex flex-col min-h-0">
          {/* Sender Selection - Dropdown next to template button */}
          <div className="flex items-center gap-2 mb-3">
            <MessageTemplatesPicker onSelect={handleTemplateSelect} />
            
            {/* Variables button */}
            <DropdownMenu open={variablesMenuOpen} onOpenChange={setVariablesMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onMouseDown={(e) => {
                    // Prevent losing focus on textarea when clicking button
                    e.preventDefault();
                  }}
                  aria-label="Insert variable"
                >
                  <Code className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {variables.map((variable) => (
                  <DropdownMenuItem
                    key={variable.key}
                    onSelect={(e) => {
                      e.preventDefault();
                      handleInsertVariable(variable.key);
                    }}
                    className="flex flex-col items-start"
                  >
                    <span className="text-sm font-medium">{`{${variable.key}}`}</span>
                    <span className="text-xs text-muted-foreground">{variable.description}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Upload button - only show for iMessage senders */}
            {isIMessageSender && canAddMore && selectedSenderId && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files)}
                  accept="*/*"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoadingSenders || !selectedSenderId}
                  aria-label="Attach files"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
              </>
            )}
            
            {/* Sender selector dropdown */}
            {selectedSenderId && availableSenders && availableSenders.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={isLoadingSenders}
                    type="button"
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
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {(() => {
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
                                onClick={() => onSenderChange(sender.id)}
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
                                onClick={() => onSenderChange(sender.id)}
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
            )}
          </div>
          
          <div 
            className={`relative border rounded-lg flex flex-col ${
              isDragging && isIMessageSender ? 'border-primary border-2' : ''
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Attachment previews inside textarea area (iOS style) */}
            {hasAttachments && (
              <div className="flex flex-wrap gap-2 p-2 border-b border-border bg-muted/30">
                {attachments.map((attachment) => {
                  // Convert AttachmentFile to message attachment format
                  const messageAttachment: Tables<'message_attachments'> = {
                    id: attachment.id,
                    filename: attachment.file.name,
                    mime_type: attachment.file.type,
                    size_bytes: attachment.file.size,
                    storage_url: attachment.storageUrl || attachment.preview || '',
                    created_at: null,
                    message_id: '', // Will be set when message is sent
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
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => {
                onMessageChange(e.target.value);
                // For SMS, prevent line breaks
                if (isSMSSender && e.target.value.includes('\n')) {
                  onMessageChange(e.target.value.replace(/\n/g, ''));
                }
                // Auto-resize textarea
                if (textareaRef.current) {
                  textareaRef.current.style.height = 'auto';
                  textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
                }
              }}
              placeholder={isIMessageSender ? "Type your message here... (or drag files)" : "Type your message here..."}
              className="resize-none font-mono text-sm border-0 min-h-[80px]"
              rows={1}
              onKeyDown={(e) => {
                // For SMS, prevent line breaks (Shift+Enter does nothing)
                if (e.key === 'Enter' && e.shiftKey && isSMSSender) {
                  e.preventDefault();
                }
              }}
            />
            {/* SMS segment counter */}
            {isSMSSender && smsSegments && (
              <div className="absolute bottom-2 right-2 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{smsSegments.characters} chars</span>
                <span>•</span>
                <span>{smsSegments.segments} {smsSegments.segments === 1 ? 'segment' : 'segments'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-3">
            {currentStudent ? (
              <div>
                <h3 className="font-semibold text-sm">{currentStudent.first_name} {currentStudent.last_name}</h3>
                <div className="text-xs text-muted-foreground">
                  {currentStudent.phone || 'No phone number'}
                </div>
              </div>
            ) : (
              <h3 className="font-semibold text-sm">Preview</h3>
            )}
            {students.length > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handlePrevious}
                  disabled={previewIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  {previewIndex + 1} / {students.length}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleNext}
                  disabled={previewIndex === students.length - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {currentStudent && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <ScrollArea className="flex-1 border rounded-lg p-4 bg-muted/30">
                {isLoadingClasses ? (
                  <div className="text-sm text-muted-foreground">
                    Loading preview...
                  </div>
                ) : (
                  <div className="flex flex-col items-end gap-2">
                    {/* Attachments */}
                    {attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 max-w-[80%]">
                        {attachments.map((attachment) => {
                          // Convert AttachmentFile to message attachment format
                          const messageAttachment: Tables<'message_attachments'> = {
                            id: attachment.id,
                            filename: attachment.file.name,
                            mime_type: attachment.file.type,
                            size_bytes: attachment.file.size,
                            storage_url: attachment.storageUrl || attachment.preview || '',
                            created_at: null,
                            message_id: '',
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
                        {previewMessage}
                      </p>
                    </div>
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}








