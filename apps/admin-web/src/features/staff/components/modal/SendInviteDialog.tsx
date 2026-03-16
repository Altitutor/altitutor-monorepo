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
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@altitutor/ui";
import { Button } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { Loader2, Mail, MessageSquare, Copy, Check, X, Phone, ChevronDown } from 'lucide-react';
import { Skeleton } from '@altitutor/ui';
import { useQueryClient } from '@tanstack/react-query';
import { invitesApi } from '@/features/auth/api/invites';
import { getSystemTemplateContentForClient } from '@/features/messages/api/systemTemplates';
import { replaceTemplateVariables } from '@/features/messages/utils/replaceTemplateVariables';
import { useAvailableSenders } from '@/features/messages/api/queries';
import { MessageTemplatesPicker } from '@/features/messages/components/MessageTemplatesPicker';
import { MessageThread } from '@/features/messages/components/MessageThread';
import { Composer } from '@/features/messages/components/Composer';
import { replaceVariablesForStaff } from '@/features/messages/utils/variableReplacerStaff';
import { getStaffClasses } from '@/features/messages/api/bulk';
import { useCurrentStaff } from '@/shared/hooks';
import { calculateSMSSegments } from '@/features/messages/utils/smsSegments';
import { templateContainsLinkVariables } from '@/features/messages/utils/generateLinkTokens';
import { generateLinkTokensForStaff } from '@/features/messages/utils/generateLinkTokens';
import { useResponsiveButtons } from '@/features/messages/hooks/useResponsiveButtons';
import { useStaffInviteToken, staffInviteTokenKeys } from '@/features/staff/hooks/useStaffInviteToken';
import { useContactIdForRelated } from '@/features/messages/hooks/useContactIdForRelated';
import type { Tables } from '@altitutor/shared';

interface SendInviteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  staffMember: Tables<'staff'>;
}

export function SendInviteDialog({
  isOpen,
  onClose,
  staffMember,
}: SendInviteDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [customMessage, setCustomMessage] = useState<string>('');
  const [selectedSenderId, setSelectedSenderId] = useState<string | null>(null);
  const [selectedRecipient, setSelectedRecipient] = useState<{ method: 'phone' | 'email'; label: string; value: string } | null>(null);
  const [isGeneratingTokens, setIsGeneratingTokens] = useState(false);
  const [composerDraft, setComposerDraft] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emailComposerRef = useRef<HTMLDivElement>(null);
  const buttonRowRef = useRef<HTMLDivElement>(null);

  const { data: inviteTokenData } = useStaffInviteToken(staffMember.id, staffMember.role, isOpen);
  const token = inviteTokenData?.token ?? null;
  const inviteUrl = inviteTokenData?.inviteUrl ?? null;

  const { data: contactIdFromQuery } = useContactIdForRelated(
    staffMember.id,
    'staff',
    !!(isOpen && selectedRecipient?.method === 'phone')
  );
  const contactId = contactIdFromQuery ?? null;

  const { data: availableSenders } = useAvailableSenders();
  const { data: currentStaff } = useCurrentStaff();
  const canExpand = useResponsiveButtons(buttonRowRef);

  const hasEmail = !!staffMember.email;
  const hasPhone = !!staffMember.phone_number;

  const recipients = useMemo(() => {
    const recs: Array<{ method: 'phone' | 'email'; label: string; value: string }> = [];
    if (hasPhone) recs.push({ method: 'phone', label: 'Phone', value: staffMember.phone_number! });
    if (hasEmail) recs.push({ method: 'email', label: 'Email', value: staffMember.email! });
    return recs;
  }, [hasPhone, hasEmail, staffMember.phone_number, staffMember.email]);

  // Helper to get sender display name
  const getSenderDisplayName = (senderId: string | null): string => {
    if (!senderId || !availableSenders) return 'Select sender';
    const sender = availableSenders.find(s => s.id === senderId);
    if (!sender) return 'Select sender';
    if (sender.sender_type === 'ALPHANUMERIC') {
      return sender.alphanumeric_sender_id || sender.label || 'Unknown';
    }
    return sender.phone_e164 || sender.label || 'Unknown';
  };

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

  // Reset draft when switching away from phone
  useEffect(() => {
    if (selectedRecipient?.method !== 'phone') {
      setComposerDraft('');
    }
  }, [selectedRecipient?.method]);

  // Pre-populate message with SMS template when inviteUrl and recipient are ready
  useEffect(() => {
    if (!inviteUrl || !selectedRecipient) return;

    const firstName = staffMember.first_name || 'there';

    let cancelled = false;
    (async () => {
      const content = await getSystemTemplateContentForClient('student_invite');
      if (cancelled) return;
      const template = replaceTemplateVariables(content, {
        first_name: firstName,
        invite_url: inviteUrl,
      });

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
  }, [inviteUrl, staffMember.first_name, selectedRecipient, composerDraft, customMessage]);

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
      await invitesApi.generateInviteToken({
        type: 'staff',
        id: staffMember.id,
      });
      queryClient.invalidateQueries({ queryKey: staffInviteTokenKeys.detail(staffMember.id, staffMember.role) });
    } catch (error) {
      console.error('Failed to generate token:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate invite token',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [staffMember.id, staffMember.role, token, toast, queryClient]);

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
        description: 'Invite link copied to clipboard',
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
          linkTokens = await generateLinkTokensForStaff(staffMember.id, staffMember.role, {
            includeInvite: template.content.includes('{invite_link}'),
            includePasswordReset: template.content.includes('{forgot_password_link}'),
          });
        } catch (error) {
          console.error('Error generating link tokens:', error);
        }
      }
      
      // Fetch staff classes
      const classes = await getStaffClasses(staffMember.id);
      
      // Replace variables with actual data
      content = await replaceVariablesForStaff(
        template.content,
        staffMember,
        classes,
        senderName,
        linkTokens ? {
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
    if (!token || !selectedRecipient || !selectedSenderId) {
      if (!selectedRecipient) {
        toast({
          title: 'Error',
          description: 'Please select a recipient',
          variant: 'destructive',
        });
      } else if (!selectedSenderId) {
        toast({
          title: 'Error',
          description: 'Please select a phone number to send from',
          variant: 'destructive',
        });
      }
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

    const isEmail = selectedRecipient.method === 'email';
    
    try {
      if (isEmail) {
        setIsSendingEmail(true);
        await invitesApi.sendInviteEmail({
          type: 'staff',
          id: staffMember.id,
          token,
          customMessage: customMessage.trim(),
        });
        setEmailSent(true);
        toast({
          title: 'Invite email sent',
          description: `An invite has been sent to ${selectedRecipient.value}`,
        });
      } else {
        setIsSendingSms(true);
        await invitesApi.sendInviteSms({
          type: 'staff',
          id: staffMember.id,
          token,
          customMessage: customMessage.trim(),
          ownedNumberId: selectedSenderId,
        });
        setSmsSent(true);
        toast({
          title: 'Invite SMS sent',
          description: `An invite has been sent to ${selectedRecipient.value}`,
        });
      }
    } catch (error) {
      console.error('Failed to send:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send',
        variant: 'destructive',
      });
    } finally {
      setIsSendingEmail(false);
      setIsSendingSms(false);
    }
  };

  const handleClose = () => {
    setEmailSent(false);
    setSmsSent(false);
    setCopied(false);
    setCustomMessage('');
    setSelectedSenderId(null);
    setSelectedRecipient(null);
    setComposerDraft('');
    onClose();
  };

  const selectedSender = availableSenders?.find(s => s.id === selectedSenderId);
  const isIMessageSender = selectedSender?.provider === 'IMESSAGE';
  const isSMSSender = selectedSender?.provider === 'TWILIO';
  const smsSegments = isSMSSender ? calculateSMSSegments(customMessage) : null;
  const isSending = isSendingEmail || isSendingSms;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="md:max-w-4xl h-[90vh] flex flex-col [&>button]:hidden">
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
                <DialogTitle>Send Invite</DialogTitle>
                <DialogDescription>
                  Send an account creation invite to {staffMember.first_name} {staffMember.last_name}
                </DialogDescription>
              </div>
            </div>
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
                <label className="text-sm font-medium">Invite Link</label>
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

              {/* Chat Window for Phone or Composer for Email */}
              {selectedRecipient && selectedRecipient.method === 'phone' ? (
                <div className="flex-1 flex flex-col min-h-0 border rounded-md overflow-hidden mx-4">
                  {/* Fixed Header with Message label and dropdown */}
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
                              disabled={!selectedRecipient}
                            >
                              {selectedRecipient ? (
                                <>
                                  {selectedRecipient.method === 'phone' ? (
                                    <MessageSquare className="h-3 w-3 mr-1" />
                                  ) : (
                                    <Mail className="h-3 w-3 mr-1" />
                                  )}
                                  <span className="text-xs">{selectedRecipient.label}</span>
                                  {selectedRecipient.method === 'phone' && (
                                    <span className="text-xs text-muted-foreground ml-1">• {selectedRecipient.value}</span>
                                  )}
                                </>
                              ) : (
                                'Select recipient'
                              )}
                              <ChevronDown className="h-3 w-3 ml-1" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            {recipients.map((option, index) => (
                              <DropdownMenuItem
                                key={`${option.method}-${index}`}
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
                                {selectedRecipient?.method === option.method && (
                                  <Check className="h-4 w-4 ml-2 shrink-0" />
                                )}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                  
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
                </div>
              ) : selectedRecipient && selectedRecipient.method === 'email' ? (
                <div ref={emailComposerRef} className="space-y-2 px-4">
                  {/* Message Composer */}
                  <div className="flex flex-col gap-2">
                    {/* Textarea row */}
                    <div className="relative">
                      <textarea
                        ref={textareaRef}
                        value={customMessage}
                        onChange={(e) => setCustomMessage(e.target.value)}
                        className="w-full text-sm px-3 py-2 border rounded-md bg-background resize-none min-h-[100px] max-h-[200px]"
                        placeholder="Enter your message..."
                        rows={4}
                        disabled={!selectedRecipient || !selectedSenderId}
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

                    {/* Button row: template/phone on left, send on right */}
                    <div ref={buttonRowRef} className="flex items-center justify-between gap-2 min-w-0">
                      {/* Left side: Template, Phone buttons */}
                      <div className="flex items-center gap-2 flex-shrink min-w-0">
                        {/* Template button */}
                        <div className="relative">
                          <MessageTemplatesPicker 
                            onSelect={handleTemplateSelect}
                            disabled={isGeneratingTokens}
                            expanded={canExpand}
                          />
                          {isGeneratingTokens && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-md pointer-events-none">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        
                        {/* Phone button - only for email mode, this is for sender selection */}
                        {availableSenders && availableSenders.length > 0 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              {canExpand ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={!selectedSenderId}
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
                                  {selectedSender ? getSenderDisplayName(selectedSender.id) : 'Phone'}
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  disabled={!selectedSenderId}
                                  type="button"
                                  className="h-10"
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
                                                {getSenderDisplayName(sender.id)}
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
                                                {getSenderDisplayName(sender.id)}
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

                      {/* Right side: Send Button */}
                      <div className="flex-shrink-0 ml-auto">
                      <Button
                        className={`px-4 py-2 text-sm rounded-md text-white hover:opacity-90 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed h-10 ${
                          isIMessageSender
                            ? 'bg-[#007AFF] dark:bg-[#0A84FF]'
                            : isSMSSender
                            ? 'bg-[#30D158] dark:bg-[#1E8E3E]'
                            : 'bg-brand-lightBlue text-brand-dark-bg'
                        }`}
                        onClick={handleSend}
                        disabled={
                          isSending || 
                          !selectedRecipient || 
                          !selectedSenderId || 
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
              ) : null}

              {recipients.length === 0 && (
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                  <p className="text-sm text-orange-800 dark:text-orange-200">
                    This staff member has no email or phone number set. Please add contact information in the Details tab before sending an invite.
                  </p>
                </div>
              )}

              {(emailSent || smsSent) && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Invite sent successfully! {staffMember.first_name} can now create their account using the link.
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

