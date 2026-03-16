'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@altitutor/ui";
import { Button } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { Loader2, Mail, MessageSquare, Copy, Check, X, ChevronDown, Paperclip } from 'lucide-react';
import { Skeleton } from '@altitutor/ui';
import { useQueryClient } from '@tanstack/react-query';
import {
  getStudentInviteMessageForClient,
  getStudentRegistrationInviteMessageForClient,
  getSenderNameFromStaff,
} from '@/features/messages/api/systemTemplates';
import { useAvailableSenders } from '@/features/messages/api/queries';
import { MessageTemplatesPicker } from '@/features/messages/components/MessageTemplatesPicker';
import { MessageThread } from '@/features/messages/components/MessageThread';
import { Composer } from '@/features/messages/components/Composer';
import { replaceVariables } from '@/features/messages/utils/variableReplacer';
import { useCurrentStaff } from '@/shared/hooks';
import { templateContainsLinkVariables } from '@/features/messages/utils/generateLinkTokens';
import { generateLinkTokensForStudent } from '@/features/messages/utils/generateLinkTokens';
import { useResponsiveButtons } from '@/features/messages/hooks/useResponsiveButtons';
import { useStudentInviteData, studentInviteDataKeys } from '../hooks/useStudentInviteData';
import {
  ExpandButton,
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
} from '@/shared/components/expandable-dialog';
import { cn } from '@/shared/utils';
import { useStudentClassesForTemplate } from '@/features/messages/hooks/useTemplatePreviewData';
import { useContactIdForRelated } from '@/features/messages/hooks/useContactIdForRelated';
import type { Tables } from '@altitutor/shared';

interface SendStudentInviteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  student: Tables<'students'>;
  linkType: 'invite' | 'registration'; // 'invite' for /invite, 'registration' for /register
}

export function SendStudentInviteDialog({
  isOpen,
  onClose,
  student,
  linkType,
}: SendStudentInviteDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [emailSent, setEmailSent] = useState<Record<string, boolean>>({});
  const [smsSent, setSmsSent] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [sendingEmail, setSendingEmail] = useState<Record<string, boolean>>({});
  const [sendingSms, setSendingSms] = useState<Record<string, boolean>>({});
  const [customMessage, setCustomMessage] = useState<string>('');
  const [selectedSenderId, setSelectedSenderId] = useState<string | null>(null);
  const [selectedRecipient, setSelectedRecipient] = useState<{ type: 'student' | 'parent'; id?: string; method: 'phone' | 'email'; label: string; value: string } | null>(null);
  const [emailAttachments, setEmailAttachments] = useState<File[]>([]);
  const [isGeneratingTokens, setIsGeneratingTokens] = useState(false);
  const [composerDraft, setComposerDraft] = useState<string>('');
  const [expanded, setExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isOpen) setExpanded(false);
  }, [isOpen]);
  const emailComposerRef = useRef<HTMLDivElement>(null);
  const buttonRowRef = useRef<HTMLDivElement>(null);

  const { data: inviteData } = useStudentInviteData(student.id, linkType, isOpen);
  const token = inviteData?.token ?? null;
  const inviteUrl = inviteData?.inviteUrl ?? null;
  const parents = useMemo(() => inviteData?.parents ?? [], [inviteData?.parents]);

  const { data: studentClasses = [] } = useStudentClassesForTemplate(isOpen ? student.id : null);

  const contactRelatedId = selectedRecipient?.type === 'student' ? student.id : selectedRecipient?.id;
  const contactType = selectedRecipient?.type === 'parent' ? 'parent' : 'student';
  const { data: contactIdFromQuery } = useContactIdForRelated(
    contactRelatedId,
    contactType,
    !!(selectedRecipient?.method === 'phone' && (selectedRecipient?.type === 'student' ? student.id : selectedRecipient?.id))
  );
  const contactId = contactIdFromQuery ?? null;

  const { data: availableSenders } = useAvailableSenders();
  const { data: currentStaff } = useCurrentStaff();
  const canExpand = useResponsiveButtons(buttonRowRef);

  const recipients = useMemo(() => {
    const recs: Array<{ type: 'student' | 'parent'; id?: string; method: 'phone' | 'email'; label: string; value: string }> = [];
    if (student.phone) {
      recs.push({ type: 'student', method: 'phone', label: 'Student Phone', value: student.phone });
    }
    parents.forEach((p) => {
      if (p.phone) {
        recs.push({ type: 'parent', id: p.id, method: 'phone', label: `${p.first_name} ${p.last_name} Phone`, value: p.phone });
      }
    });
    if (student.email) {
      recs.push({ type: 'student', method: 'email', label: 'Student Email', value: student.email });
    }
    parents.forEach((p) => {
      if (p.email) {
        recs.push({ type: 'parent', id: p.id, method: 'email', label: `${p.first_name} ${p.last_name} Email`, value: p.email });
      }
    });
    return recs;
  }, [student.phone, student.email, parents]);

  // Set default sender to iMessage when senders load
  useEffect(() => {
    if (availableSenders && availableSenders.length > 0 && !selectedSenderId) {
      const imessageSender = availableSenders.find(s => s.provider === 'IMESSAGE');
      const defaultSender = imessageSender || availableSenders.find(s => s.is_default) || availableSenders[0];
      setSelectedSenderId(defaultSender.id);
    }
  }, [availableSenders, selectedSenderId]);

  // Set default recipient when recipients load
  useEffect(() => {
    if (recipients.length > 0 && !selectedRecipient) {
      setSelectedRecipient(recipients[0]);
    }
  }, [recipients, selectedRecipient]);

  // Reset draft/attachments when switching away from phone
  useEffect(() => {
    if (selectedRecipient?.method !== 'phone') {
      setComposerDraft('');
      setEmailAttachments([]);
    }
  }, [selectedRecipient?.method]);

  // Reset draft when switching phone recipients (template will repopulate)
  useEffect(() => {
    if (selectedRecipient?.method === 'phone') {
      setComposerDraft('');
    }
  }, [selectedRecipient?.id, selectedRecipient?.type, selectedRecipient?.method]);

  // Pre-populate message with SMS template when inviteUrl and recipient are ready
  useEffect(() => {
    if (!inviteUrl || !selectedRecipient) return;

    const firstName =
      selectedRecipient.type === 'parent'
        ? parents.find((p) => p.id === selectedRecipient.id)?.first_name || 'there'
        : student.first_name || 'there';

    const studentName =
      linkType === 'registration' && selectedRecipient.type === 'parent'
        ? `${student.first_name} ${student.last_name}`
        : '';

    const senderName = getSenderNameFromStaff(currentStaff);

    let cancelled = false;
    (async () => {
      const template =
        linkType === 'registration'
          ? await getStudentRegistrationInviteMessageForClient({
              firstName,
              inviteUrl,
              studentName,
              senderName,
            })
          : await getStudentInviteMessageForClient({
              firstName,
              inviteUrl,
              senderName,
            });
      if (cancelled) return;

      if (selectedRecipient.method === 'phone') {
        setComposerDraft((prev) => (prev ? prev : template));
        setCustomMessage('');
      } else {
        setCustomMessage((prev) => (prev ? prev : template));
        setComposerDraft('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    inviteUrl,
    linkType,
    student.first_name,
    student.last_name,
    selectedRecipient,
    parents,
    currentStaff,
    composerDraft,
    customMessage,
  ]);

  // Auto-expand textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [customMessage]);

  const handleGenerateToken = useCallback(async () => {
    // Skip if we already have a token
    if (token) return;

    try {
      setIsGenerating(true);
      
      if (linkType === 'invite') {
        // Use invite API
        const response = await fetch('/api/invites/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'student', id: student.id }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to generate invite token');
        }

        await response.json();
        queryClient.invalidateQueries({ queryKey: studentInviteDataKeys.detail(student.id, 'invite') });
      } else {
        // Use registration API
        const response = await fetch('/api/students/send-registration-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId: student.id }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to generate registration invite');
        }

        await response.json();
        queryClient.invalidateQueries({ queryKey: studentInviteDataKeys.detail(student.id, 'register') });
      }
    } catch (error) {
      console.error('Failed to generate token:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : `Failed to generate ${linkType === 'invite' ? 'invite' : 'registration'} link`,
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [student.id, linkType, token, toast, queryClient]);

  // Generate token when modal opens ONLY if no existing token
  useEffect(() => {
    if (isOpen && !token) {
      handleGenerateToken();
    }
  }, [isOpen, token, handleGenerateToken]);

  const handleCopyUrl = async () => {
    if (!inviteUrl) return;
    
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast({
        title: 'Copied!',
        description: `${linkType === 'invite' ? 'Invite' : 'Registration'} link copied to clipboard`,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: 'Failed to copy',
        description: 'Please copy the link manually',
        variant: 'destructive',
      });
    }
  };

  // Handle template selection
  const handleTemplateSelect = async (template: Tables<'message_templates'>) => {
    let content = template.content;
    
    const senderName = currentStaff 
      ? `${currentStaff.first_name || ''} ${currentStaff.last_name || ''}`.trim() 
      : null;
    
    // Check if template contains link variables
    const needsLinks = templateContainsLinkVariables(template.content);
    
    try {
      setIsGeneratingTokens(needsLinks);
      
      // Generate link tokens if template contains link variables
      let linkTokens = null;
      if (needsLinks && token) {
        try {
          linkTokens = await generateLinkTokensForStudent(student.id, {
            includeRegistration: template.content.includes('{registration_link}'),
            includeInvite: template.content.includes('{invite_link}'),
            includePasswordReset: template.content.includes('{forgot_password_link}'),
          });
        } catch (error) {
          console.error('Error generating link tokens:', error);
        }
      }
      
      // Replace variables with actual data
      content = await replaceVariables(
        template.content,
        student,
        studentClasses,
        senderName,
        linkTokens ? {
          registrationToken: linkTokens.registrationToken || token,
          inviteToken: linkTokens.inviteToken || token,
          forgotPasswordLink: linkTokens.forgotPasswordLink,
        } : undefined
      );
      
      setCustomMessage(content);
      
      // Focus textarea after template insertion
      setTimeout(() => {
        textareaRef.current?.focus();
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(content.length, content.length);
        }
      }, 0);
    } catch (error) {
      console.error('Error processing template:', error);
      toast({
        title: 'Error',
        description: 'Failed to process template',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingTokens(false);
    }
  };

  // Handle send
  const handleSend = async () => {
    if (!token || !selectedRecipient) {
      if (!selectedRecipient) {
        toast({
          title: 'Error',
          description: 'Please select a recipient',
          variant: 'destructive',
        });
      }
      return;
    }

    const isEmail = selectedRecipient.method === 'email';
    
    // For phone, require sender ID
    if (!isEmail && !selectedSenderId) {
      toast({
        title: 'Error',
        description: 'Please select a phone number to send from',
        variant: 'destructive',
      });
      return;
    }

    if (!customMessage.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a message',
        variant: 'destructive',
      });
      return;
    }

    const key = selectedRecipient.type === 'student' ? 'student' : `parent-${selectedRecipient.id}`;
    
    try {
      if (isEmail) {
        setSendingEmail(prev => ({ ...prev, [key]: true }));
        
        if (linkType === 'invite') {
          const formData = new FormData();
          formData.append('type', 'student');
          formData.append('id', student.id);
          formData.append('token', token);
          formData.append('customMessage', customMessage.trim());
          
          // Add attachments
          emailAttachments.forEach((file, index) => {
            formData.append(`attachment-${index}`, file);
          });
          
          const result = await fetch('/api/invites/send-email', {
            method: 'POST',
            body: formData,
          });

          if (!result.ok) {
            const error = await result.json();
            throw new Error(error.error || 'Failed to send email');
          }

          setEmailSent(prev => ({ ...prev, [key]: true }));
          setEmailAttachments([]); // Clear attachments after sending
          toast({
            title: 'Invite email sent',
            description: `An invite has been sent to ${selectedRecipient.value}`,
          });
        } else {
          const formData = new FormData();
          formData.append('studentId', student.id);
          formData.append('token', token);
          formData.append('sendEmail', 'true');
          formData.append('recipientType', selectedRecipient.type);
          if (selectedRecipient.id) {
            formData.append('recipientId', selectedRecipient.id);
          }
          formData.append('contactMethod', 'email');
          formData.append('customMessage', customMessage.trim());
          
          // Add attachments
          emailAttachments.forEach((file, index) => {
            formData.append(`attachment-${index}`, file);
          });
          
          const response = await fetch('/api/students/send-registration-invite', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to send email');
          }

          setEmailSent(prev => ({ ...prev, [key]: true }));
          setEmailAttachments([]); // Clear attachments after sending
          toast({
            title: 'Registration email sent',
            description: `The registration link has been sent via email to ${selectedRecipient.value}`,
          });
        }
      } else {
        setSendingSms(prev => ({ ...prev, [key]: true }));
        
        if (linkType === 'invite') {
          const result = await fetch('/api/invites/send-sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'student',
              id: student.id,
              token,
              customMessage: customMessage.trim(),
              ownedNumberId: selectedSenderId,
            }),
          });

          if (!result.ok) {
            const error = await result.json();
            throw new Error(error.error || 'Failed to send SMS');
          }

          setSmsSent(prev => ({ ...prev, [key]: true }));
          toast({
            title: 'Invite SMS sent',
            description: `An invite has been sent to ${selectedRecipient.value}`,
          });
        } else {
          const response = await fetch('/api/students/send-registration-invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              studentId: student.id,
              token,
              sendSms: true,
              recipientType: selectedRecipient.type,
              recipientId: selectedRecipient.id,
              contactMethod: 'sms',
              customMessage: customMessage.trim(),
              ownedNumberId: selectedSenderId,
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            const errorMessage = error.error || 'Failed to send SMS';
            const errorDetails = error.details ? ` Details: ${error.details.join('; ')}` : '';
            console.error('SMS send error:', error);
            throw new Error(errorMessage + errorDetails);
          }

          setSmsSent(prev => ({ ...prev, [key]: true }));
          toast({
            title: 'Registration SMS sent',
            description: `The registration link has been sent via SMS to ${selectedRecipient.value}`,
          });
        }
      }
    } catch (error) {
      console.error('Failed to send:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send',
        variant: 'destructive',
      });
    } finally {
      setSendingEmail(prev => ({ ...prev, [key]: false }));
      setSendingSms(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleClose = () => {
    setEmailSent({});
    setSmsSent({});
    setCopied(false);
    setSendingEmail({});
    setSendingSms({});
    setCustomMessage('');
    setSelectedSenderId(null);
    setSelectedRecipient(null);
    setComposerDraft('');
    setEmailAttachments([]);
    onClose();
  };

  const isSending = Object.values(sendingEmail).some(v => v) || Object.values(sendingSms).some(v => v);
  
  const dialogTitle = linkType === 'invite' ? 'Send Invite' : 'Send Registration Link';
  const dialogDescription = linkType === 'invite' 
    ? `Send an account creation invite to ${student.first_name} ${student.last_name}`
    : `Send a registration link to ${student.first_name} ${student.last_name} to complete registration`;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          'md:max-w-4xl h-[90vh] flex flex-col [&>button]:hidden',
          EXPANDABLE_DIALOG_TRANSITION,
          expanded && EXPANDED_DIALOG_CONTENT_CLASS
        )}
      >
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <Button
                variant="outline"
                size="icon"
                onClick={handleClose}
                className="shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="flex-1">
                <DialogTitle>{dialogTitle}</DialogTitle>
                <DialogDescription>
                  {dialogDescription}
                </DialogDescription>
              </div>
            </div>
            <ExpandButton expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
          </div>
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0 py-4 overflow-hidden">
          {/* Loading State */}
          {isGenerating ? (
            <div className="flex flex-col gap-4 px-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : inviteUrl && (
            <>
              {/* Invite Link - Full Width at Top */}
              <div className="space-y-2 flex-shrink-0 px-4 pb-4">
                <label className="text-sm font-medium">
                  {linkType === 'invite' ? 'Invite Link' : 'Registration Link'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inviteUrl}
                    readOnly
                    className="flex-1 px-3 py-2 text-sm bg-muted border rounded-md"
                    onClick={(e) => e.currentTarget.select()}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyUrl}
                    className="flex-shrink-0"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Message Section - Always show when recipient is selected */}
              {selectedRecipient ? (
                <div className="flex-1 flex flex-col min-h-0 border rounded-md overflow-hidden mx-4">
                  {/* Fixed Header with Message label and recipient dropdown */}
                  <div className="px-3 py-2 border-b flex items-center justify-between flex-shrink-0 bg-background">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">Message</span>
                      {recipients.length > 0 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7"
                            >
                              {selectedRecipient.method === 'phone' ? (
                                <MessageSquare className="h-3 w-3 mr-1" />
                              ) : (
                                <Mail className="h-3 w-3 mr-1" />
                              )}
                              <span className="text-xs">{selectedRecipient.label}</span>
                              {selectedRecipient.method === 'phone' && (
                                <span className="text-xs text-muted-foreground ml-1">• {selectedRecipient.value}</span>
                              )}
                              <ChevronDown className="h-3 w-3 ml-1" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            {recipients.map((option, index) => (
                              <DropdownMenuItem
                                key={`${option.type}-${option.id || 'student'}-${option.method}-${index}`}
                                onClick={() => setSelectedRecipient(option)}
                                className="flex items-center justify-between"
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  {option.method === 'phone' ? (
                                    <MessageSquare className="h-4 w-4 shrink-0" />
                                  ) : (
                                    <Mail className="h-4 w-4 shrink-0" />
                                  )}
                                  <div className="flex flex-col min-w-0 flex-1">
                                    <span className="text-sm font-medium truncate">{option.label}</span>
                                    <span className="text-xs text-muted-foreground truncate">{option.value}</span>
                                  </div>
                                </div>
                                {selectedRecipient?.type === option.type && 
                                 selectedRecipient?.id === option.id && 
                                 selectedRecipient?.method === option.method && (
                                  <Check className="h-4 w-4 ml-2 shrink-0" />
                                )}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                  
                  {/* Content: Chat Thread for Phone, Composer for Email */}
                  {selectedRecipient.method === 'phone' ? (
                    <>
                      {/* Scrollable Message Thread */}
                      {contactId ? (
                        <>
                          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                            <MessageThread contactId={contactId} />
                          </div>
                          <div className="flex-shrink-0 border-t">
                            <Composer 
                              contactId={contactId}
                              draft={composerDraft}
                              onDraftChange={setComposerDraft}
                              onDraftClear={() => setComposerDraft('')}
                              onBeforeSend={async (_messageBody, _selectedSenderId) => {
                                // Allow sending through Composer - it handles the message sending
                                return null;
                              }}
                            />
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 flex items-center justify-center">
                          <div className="flex flex-col gap-2 w-full px-4">
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    /* Email Composer */
                    <div ref={emailComposerRef} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                      {/* Attachment previews */}
                      {emailAttachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 p-2 border-b flex-shrink-0">
                          {emailAttachments.map((file, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs"
                            >
                              <span className="truncate max-w-[150px]">{file.name}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEmailAttachments(prev => prev.filter((_, i) => i !== index));
                                }}
                                className="ml-1 hover:text-destructive"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Hidden file input */}
                      <input
                        type="file"
                        id="email-attachment"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          setEmailAttachments(prev => [...prev, ...files]);
                        }}
                        disabled={!selectedRecipient}
                      />
                      
                      <div className="flex flex-col gap-2 p-2 flex-shrink-0">
                        {/* Textarea row */}
                        <div className="relative">
                          <textarea
                            ref={textareaRef}
                            value={customMessage}
                            onChange={(e) => setCustomMessage(e.target.value)}
                            className="w-full text-sm px-3 py-2 border rounded-md bg-background resize-none min-h-[60px] max-h-[200px]"
                            placeholder="Enter your message..."
                            disabled={!selectedRecipient}
                            rows={1}
                          />
                        </div>
                        
                        {/* Button row: template/attachments on left, send on right */}
                        <div ref={buttonRowRef} className="flex items-center justify-between gap-2 min-w-0">
                          {/* Left side: Template, Attachments buttons */}
                          <div className="flex items-center gap-2 flex-shrink min-w-0">
                            {/* Template button */}
                            <div className="relative">
                              <MessageTemplatesPicker 
                                onSelect={handleTemplateSelect}
                                disabled={isGeneratingTokens || !selectedRecipient}
                                expanded={canExpand}
                              />
                              {isGeneratingTokens && (
                                <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-md pointer-events-none">
                                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            
                            {/* Attachment button */}
                            {canExpand ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => document.getElementById('email-attachment')?.click()}
                                disabled={!selectedRecipient}
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
                                onClick={() => document.getElementById('email-attachment')?.click()}
                                disabled={!selectedRecipient}
                                className="h-10"
                                aria-label="Attach files"
                              >
                                <Paperclip className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          
                          {/* Right side: Send Button */}
                          <div className="flex-shrink-0 ml-auto">
                          <Button
                            className="px-4 py-2 text-sm rounded-md text-white hover:opacity-90 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed h-10 bg-brand-lightBlue text-brand-dark-bg"
                            onClick={handleSend}
                            disabled={
                              isSending || 
                              !selectedRecipient || 
                              !customMessage.trim()
                            }
                          >
                            {isSending ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Sending...
                              </>
                            ) : (
                              'Send'
                            )}
                          </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {recipients.length === 0 && (
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                  <p className="text-sm text-orange-800 dark:text-orange-200">
                    No email or phone number found for parents or student. Please add contact information before sending.
                  </p>
                </div>
              )}

              {(Object.keys(emailSent).length > 0 || Object.keys(smsSent).length > 0) && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    {linkType === 'invite' 
                      ? `Invite sent successfully! ${student.first_name} can now create their account using the link.`
                      : 'Registration link sent successfully! The recipient can now complete the student\'s registration.'}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

