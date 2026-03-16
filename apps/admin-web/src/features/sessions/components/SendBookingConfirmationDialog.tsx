'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { useToast } from '@altitutor/ui';
import { Loader2, Mail, MessageSquare, Copy, Check, X, ChevronDown, Paperclip } from 'lucide-react';
import { Skeleton } from '@altitutor/ui';
import { format } from 'date-fns';
import { getBookingConfirmationUrl } from '@/shared/utils/invites';
import {
  getBookingConfirmationMessageForClient,
  getSenderNameFromStaff,
} from '@/features/messages/api/systemTemplates';
import { MessageThread } from '@/features/messages/components/MessageThread';
import { Composer } from '@/features/messages/components/Composer';
import { MessageTemplatesPicker } from '@/features/messages/components/MessageTemplatesPicker';
import { replaceVariables } from '@/features/messages/utils/variableReplacer';
import { useCurrentStaff } from '@/shared/hooks';
import { useContactIdForRelated } from '@/features/messages/hooks/useContactIdForRelated';
import { useResponsiveButtons } from '@/features/messages/hooks/useResponsiveButtons';
import { useStudentClassesForTemplate } from '@/features/messages/hooks/useTemplatePreviewData';
import { useBookingConfirmationData } from '../hooks/useBookingConfirmationData';
import type { Tables } from '@altitutor/shared';

interface SendBookingConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  studentId: string;
}

export function SendBookingConfirmationDialog({
  isOpen,
  onClose,
  sessionId,
  studentId,
}: SendBookingConfirmationDialogProps) {
  const { toast } = useToast();
  const [emailSent, setEmailSent] = useState<Record<string, boolean>>({});
  const [smsSent, setSmsSent] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [sendingEmail, setSendingEmail] = useState<Record<string, boolean>>({});
  const [sendingSms, setSendingSms] = useState<Record<string, boolean>>({});
  const [customMessage, setCustomMessage] = useState<string>('');
  const [selectedRecipient, setSelectedRecipient] = useState<{
    type: 'student' | 'parent';
    id?: string;
    method: 'phone' | 'email';
    label: string;
    value: string;
  } | null>(null);
  const [emailAttachments, setEmailAttachments] = useState<File[]>([]);
  const [composerDraft, setComposerDraft] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emailComposerRef = useRef<HTMLDivElement>(null);
  const buttonRowRef = useRef<HTMLDivElement>(null);

  const { data, isLoading: isDataLoading, isError } = useBookingConfirmationData(
    studentId,
    sessionId,
    isOpen
  );
  const student = data?.student ?? null;
  const parents = useMemo(() => data?.parents ?? [], [data?.parents]);
  const session = data?.session ?? null;
  const bookingUrl = sessionId ? getBookingConfirmationUrl(sessionId) : null;

  const sessionDate = session?.start_at
    ? format(new Date(session.start_at), 'EEEE, dd MMMM yyyy')
    : undefined;
  const sessionTime =
    session?.start_at && session?.end_at
      ? `${format(new Date(session.start_at), 'h:mm a')} - ${format(new Date(session.end_at), 'h:mm a')}`
      : session?.start_at
        ? format(new Date(session.start_at), 'h:mm a')
        : undefined;

  const contactRelatedId =
    selectedRecipient?.type === 'student' ? studentId : selectedRecipient?.id;
  const contactType = selectedRecipient?.type === 'parent' ? 'parent' : 'student';
  const { data: contactIdFromQuery } = useContactIdForRelated(
    contactRelatedId,
    contactType,
    !!(selectedRecipient?.method === 'phone' && contactRelatedId)
  );
  const contactId = contactIdFromQuery ?? null;

  const { data: currentStaff } = useCurrentStaff();
  const { data: studentClasses = [] } = useStudentClassesForTemplate(isOpen ? studentId : null);
  const canExpand = useResponsiveButtons(buttonRowRef);

  const recipients = useMemo(() => {
    if (!student) return [];
    const recs: Array<{
      type: 'student' | 'parent';
      id?: string;
      method: 'phone' | 'email';
      label: string;
      value: string;
    }> = [];
    if (student.phone) {
      recs.push({
        type: 'student',
        method: 'phone',
        label: 'Student Phone',
        value: student.phone,
      });
    }
    parents.forEach((p) => {
      if (p.phone) {
        recs.push({
          type: 'parent',
          id: p.id,
          method: 'phone',
          label: `${p.first_name} ${p.last_name} Phone`,
          value: p.phone,
        });
      }
    });
    if (student.email) {
      recs.push({
        type: 'student',
        method: 'email',
        label: 'Student Email',
        value: student.email,
      });
    }
    parents.forEach((p) => {
      if (p.email) {
        recs.push({
          type: 'parent',
          id: p.id,
          method: 'email',
          label: `${p.first_name} ${p.last_name} Email`,
          value: p.email,
        });
      }
    });
    return recs;
  }, [student, parents]);

  useEffect(() => {
    if (isOpen && isError) {
      toast({
        title: 'Error',
        description: 'Failed to load student data',
        variant: 'destructive',
      });
    }
  }, [isOpen, isError, toast]);

  useEffect(() => {
    if (recipients.length > 0 && !selectedRecipient) {
      setSelectedRecipient(recipients[0]);
    }
  }, [recipients, selectedRecipient]);

  useEffect(() => {
    if (selectedRecipient?.method !== 'phone') {
      setComposerDraft('');
      setEmailAttachments([]);
    }
  }, [selectedRecipient?.method]);

  useEffect(() => {
    if (selectedRecipient?.method === 'phone') {
      setComposerDraft('');
    }
  }, [selectedRecipient?.id, selectedRecipient?.type, selectedRecipient?.method]);

  useEffect(() => {
    if (!bookingUrl || !selectedRecipient || !student) return;

    const firstName =
      selectedRecipient.type === 'parent'
        ? parents.find((p) => p.id === selectedRecipient.id)?.first_name || 'there'
        : student.first_name || 'there';

    const senderName = getSenderNameFromStaff(currentStaff);

    let cancelled = false;
    (async () => {
      const template = await getBookingConfirmationMessageForClient({
        firstName,
        bookingUrl: bookingUrl ?? '',
        sessionDate,
        sessionTime,
        sessionType: session?.type ?? null,
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
    bookingUrl,
    sessionDate,
    sessionTime,
    session?.type,
    student,
    parents,
    selectedRecipient,
    composerDraft,
    customMessage,
    currentStaff,
  ]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [customMessage]);

  const handleCopyUrl = async () => {
    if (!bookingUrl) return;
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      toast({
        title: 'Copied!',
        description: 'Booking confirmation link copied to clipboard',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: 'Failed to copy',
        description: 'Please copy the link manually',
        variant: 'destructive',
      });
    }
  };

  const handleTemplateSelect = async (template: Tables<'message_templates'>) => {
    if (!student) return;
    const senderName = currentStaff
      ? `${currentStaff.first_name || ''} ${currentStaff.last_name || ''}`.trim()
      : null;
    try {
      const content = await replaceVariables(
        template.content,
        student,
        studentClasses,
        senderName ?? undefined,
        undefined
      );
      setCustomMessage(content);
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
    }
  };

  const handleSendEmail = async () => {
    if (!sessionId || !studentId || !selectedRecipient || selectedRecipient.method !== 'email') {
      if (!selectedRecipient) {
        toast({
          title: 'Error',
          description: 'Please select a recipient',
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

    const key =
      selectedRecipient.type === 'student' ? 'student' : `parent-${selectedRecipient.id}`;

    try {
      setSendingEmail((prev) => ({ ...prev, [key]: true }));

      const response = await fetch('/api/sessions/send-booking-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          studentId,
          sendEmail: true,
          recipientType: selectedRecipient.type,
          recipientId: selectedRecipient.id ?? undefined,
          customMessage: customMessage.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send email');
      }

      setEmailSent((prev) => ({ ...prev, [key]: true }));
      setEmailAttachments([]);
      toast({
        title: 'Email sent',
        description: `Booking confirmation has been sent to ${selectedRecipient.value}`,
      });
    } catch (error) {
      console.error('Failed to send email:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send email',
        variant: 'destructive',
      });
    } finally {
      setSendingEmail((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleClose = () => {
    setEmailSent({});
    setSmsSent({});
    setCopied(false);
    setSendingEmail({});
    setSendingSms({});
    setCustomMessage('');
    setSelectedRecipient(null);
    setComposerDraft('');
    setEmailAttachments([]);
    onClose();
  };

  const isSending =
    Object.values(sendingEmail).some(Boolean) || Object.values(sendingSms).some(Boolean);

  if (!student && !isDataLoading) {
    return null;
  }

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
                <DialogTitle>Send Booking Confirmation Link</DialogTitle>
                <DialogDescription>
                  Send the booking confirmation link for this session to{' '}
                  {student?.first_name} {student?.last_name}&apos;s parent(s)
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0 py-4 overflow-hidden">
          {isDataLoading ? (
            <div className="flex flex-col gap-4 px-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            bookingUrl &&
            student && (
              <>
                <div className="space-y-2 flex-shrink-0 px-4 pb-4">
                  <label className="text-sm font-medium">Booking Confirmation Link</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={bookingUrl}
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

                {selectedRecipient ? (
                  <div className="flex-1 flex flex-col min-h-0 border rounded-md overflow-hidden mx-4">
                    <div className="px-3 py-2 border-b flex items-center justify-between flex-shrink-0 bg-background">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">Message</span>
                        {recipients.length > 0 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="h-7">
                                {selectedRecipient.method === 'phone' ? (
                                  <MessageSquare className="h-3 w-3 mr-1" />
                                ) : (
                                  <Mail className="h-3 w-3 mr-1" />
                                )}
                                <span className="text-xs">{selectedRecipient.label}</span>
                                {selectedRecipient.method === 'phone' && (
                                  <span className="text-xs text-muted-foreground ml-1">
                                    • {selectedRecipient.value}
                                  </span>
                                )}
                                <ChevronDown className="h-3 w-3 ml-1" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              {recipients.map((option, index) => (
                                <DropdownMenuItem
                                  key={`${option.type}-${option.id ?? 'student'}-${option.method}-${index}`}
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
                                      <span className="text-sm font-medium truncate">
                                        {option.label}
                                      </span>
                                      <span className="text-xs text-muted-foreground truncate">
                                        {option.value}
                                      </span>
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

                    {selectedRecipient.method === 'phone' ? (
                      <>
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
                                onBeforeSend={async () => null}
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
                      <div
                        ref={emailComposerRef}
                        className="flex-1 flex flex-col min-h-0 overflow-hidden"
                      >
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
                                    setEmailAttachments((prev) =>
                                      prev.filter((_, i) => i !== index)
                                    );
                                  }}
                                  className="ml-1 hover:text-destructive"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <input
                          type="file"
                          id="booking-email-attachment"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            const files = Array.from(e.target.files ?? []);
                            setEmailAttachments((prev) => [...prev, ...files]);
                          }}
                          disabled={!selectedRecipient}
                        />

                        <div className="flex flex-col gap-2 p-2 flex-shrink-0">
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

                          <div
                            ref={buttonRowRef}
                            className="flex items-center justify-between gap-2 min-w-0"
                          >
                            <div className="flex items-center gap-2 flex-shrink min-w-0">
                              <MessageTemplatesPicker
                                onSelect={handleTemplateSelect}
                                disabled={!selectedRecipient}
                                expanded={canExpand}
                              />
                              {canExpand ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    document.getElementById('booking-email-attachment')?.click()
                                  }
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
                                  onClick={() =>
                                    document.getElementById('booking-email-attachment')?.click()
                                  }
                                  disabled={!selectedRecipient}
                                  className="h-10"
                                  aria-label="Attach files"
                                >
                                  <Paperclip className="h-4 w-4" />
                                </Button>
                              )}
                            </div>

                            <div className="flex-shrink-0 ml-auto">
                              <Button
                                className="px-4 py-2 text-sm rounded-md text-white hover:opacity-90 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed h-10 bg-brand-lightBlue text-brand-dark-bg"
                                onClick={handleSendEmail}
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
                  <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mx-4">
                    <p className="text-sm text-orange-800 dark:text-orange-200">
                      No email or phone found for parents or student. Please add contact
                      information before sending.
                    </p>
                  </div>
                )}

                {(Object.keys(emailSent).length > 0 || Object.keys(smsSent).length > 0) && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg mx-4">
                    <p className="text-sm text-green-800 dark:text-green-200">
                      Booking confirmation link sent successfully!
                    </p>
                  </div>
                )}
              </>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
