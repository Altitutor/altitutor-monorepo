'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { getInviteUrlForStudent } from '@/shared/utils/invites';
import { getInviteSmsTemplate } from '@/shared/lib/sms-templates';
import { useAvailableSenders, getContactIdByRelatedId } from '@/features/messages/api/queries';
import { MessageTemplatesPicker } from '@/features/messages/components/MessageTemplatesPicker';
import { MessageThread } from '@/features/messages/components/MessageThread';
import { Composer } from '@/features/messages/components/Composer';
import { replaceVariables } from '@/features/messages/utils/variableReplacer';
import { getStudentClasses } from '@/features/messages/api/bulk';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { calculateSMSSegments } from '@/features/messages/utils/smsSegments';
import { templateContainsLinkVariables } from '@/features/messages/utils/generateLinkTokens';
import { generateLinkTokensForStudent } from '@/features/messages/utils/generateLinkTokens';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState<Record<string, boolean>>({});
  const [smsSent, setSmsSent] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [sendingEmail, setSendingEmail] = useState<Record<string, boolean>>({});
  const [sendingSms, setSendingSms] = useState<Record<string, boolean>>({});
  const [parents, setParents] = useState<Array<{ id: string; first_name: string; last_name: string; email: string | null; phone: string | null }>>([]);
  const [customMessage, setCustomMessage] = useState<string>('');
  const [selectedSenderId, setSelectedSenderId] = useState<string | null>(null);
  const [selectedRecipient, setSelectedRecipient] = useState<{ type: 'student' | 'parent'; id?: string; method: 'phone' | 'email'; label: string; value: string } | null>(null);
  const [studentClasses, setStudentClasses] = useState<Array<{ class: Tables<'classes'>, subject: Tables<'subjects'> | null }>>([]);
  const [isGeneratingTokens, setIsGeneratingTokens] = useState(false);
  const [contactId, setContactId] = useState<string | null>(null);
  const [composerDraft, setComposerDraft] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { data: availableSenders } = useAvailableSenders();
  const { data: currentStaff } = useCurrentStaff();

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

  // Fetch parent data and existing token, initialize message
  useEffect(() => {
    if (!isOpen || !student.id) return;

    const fetchData = async () => {
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      
      // Fetch student with invite_token to check for existing token
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('invite_token')
        .eq('id', student.id)
        .single();

      // If there's an existing token, use it instead of generating a new one
      if (!studentError && studentData?.invite_token) {
        setToken(studentData.invite_token);
        const path = linkType === 'invite' ? 'invite' : 'register';
        const url = getInviteUrlForStudent(studentData.invite_token, path);
        setInviteUrl(url);
      }
      
      // Fetch parents
      const { data: parentsData, error: parentsError } = await supabase
        .from('parents_students')
        .select('parent_id, parents(id, first_name, last_name, email, phone)')
        .eq('student_id', student.id);

      if (!parentsError && parentsData) {
        const parentList = parentsData
          .map((ps: any) => ps.parents)
          .filter((p: any) => p !== null);
        setParents(parentList);
      }
    };

    fetchData();
  }, [isOpen, student.id, linkType]);

  // Build recipient options and set default
  useEffect(() => {
    if (!isOpen || !student.id) return;

    const recipients: Array<{ type: 'student' | 'parent'; id?: string; method: 'phone' | 'email'; label: string; value: string }> = [];
    
    // Priority: student phone > parent phone > student email > parent email
    if (student.phone) {
      recipients.push({
        type: 'student',
        method: 'phone',
        label: 'Student Phone',
        value: student.phone,
      });
    }
    
    parents.forEach((parent) => {
      if (parent.phone) {
        recipients.push({
          type: 'parent',
          id: parent.id,
          method: 'phone',
          label: `${parent.first_name} ${parent.last_name} Phone`,
          value: parent.phone,
        });
      }
    });
    
    if (student.email) {
      recipients.push({
        type: 'student',
        method: 'email',
        label: 'Student Email',
        value: student.email,
      });
    }
    
    parents.forEach((parent) => {
      if (parent.email) {
        recipients.push({
          type: 'parent',
          id: parent.id,
          method: 'email',
          label: `${parent.first_name} ${parent.last_name} Email`,
          value: parent.email,
        });
      }
    });

    // Set default recipient (first one) only if not already set
    if (recipients.length > 0 && !selectedRecipient) {
      setSelectedRecipient(recipients[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, student.id, student.phone, student.email, parents]);

  // Load student classes for template variable replacement
  useEffect(() => {
    if (!isOpen || !student.id) return;
    
    const loadClasses = async () => {
      try {
        const classes = await getStudentClasses(student.id);
        setStudentClasses(classes);
      } catch (error) {
        console.error('Error loading student classes:', error);
      }
    };
    
    loadClasses();
  }, [isOpen, student.id]);

  // Get contactId when phone recipient is selected
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SendStudentInviteDialog.tsx:203',message:'ContactId effect triggered',data:{selectedRecipient:selectedRecipient?.method,currentContactId:contactId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    if (!selectedRecipient || selectedRecipient.method !== 'phone') {
      setContactId(null);
      setComposerDraft(''); // Reset draft when switching away from phone
      return;
    }

    const fetchContactId = async () => {
      try {
        // Reset draft when switching phone recipients
        setComposerDraft('');
        
        if (selectedRecipient.type === 'student') {
          const cid = await getContactIdByRelatedId(student.id, 'student');
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SendStudentInviteDialog.tsx:213',message:'ContactId fetched for student',data:{contactId:cid,studentId:student.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          setContactId(cid);
        } else if (selectedRecipient.type === 'parent' && selectedRecipient.id) {
          const cid = await getContactIdByRelatedId(selectedRecipient.id, 'parent');
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SendStudentInviteDialog.tsx:217',message:'ContactId fetched for parent',data:{contactId:cid,parentId:selectedRecipient.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          setContactId(cid);
        }
      } catch (error) {
        console.error('Error fetching contactId:', error);
        setContactId(null);
      }
    };

    fetchContactId();
  }, [selectedRecipient, student.id]);

  // Pre-populate message with SMS template when inviteUrl and recipient are ready
  useEffect(() => {
    if (!inviteUrl || !selectedRecipient) return;
    
    const firstName = selectedRecipient.type === 'parent' 
      ? parents.find(p => p.id === selectedRecipient.id)?.first_name || 'there'
      : student.first_name || 'there';
    
    const studentName = linkType === 'registration' && selectedRecipient.type === 'parent'
      ? `${student.first_name} ${student.last_name}`
      : undefined;
    
    const template = getInviteSmsTemplate({
      firstName,
      inviteUrl,
      linkType,
      studentName,
    });
    
    // Set template in appropriate place based on method
    if (selectedRecipient.method === 'phone') {
      // Only set if draft is empty (don't overwrite user edits)
      if (!composerDraft) {
        setComposerDraft(template);
      }
      // Clear email message when switching to phone
      if (customMessage) {
        setCustomMessage('');
      }
    } else {
      // Only set if message is empty (don't overwrite user edits)
      if (!customMessage) {
        setCustomMessage(template);
      }
      // Clear composer draft when switching to email
      if (composerDraft) {
        setComposerDraft('');
      }
    }
  }, [inviteUrl, linkType, student.first_name, student.last_name, selectedRecipient, parents]);

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

        const result = await response.json();
        setToken(result.token);
        
        // Build the invite URL for student-web
        const url = getInviteUrlForStudent(result.token, 'invite');
        setInviteUrl(url);
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

        const result = await response.json();
        setToken(result.token);
        
        // Build the registration URL for student-web
        const url = getInviteUrlForStudent(result.token, 'register');
        setInviteUrl(url);
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
  }, [student.id, linkType, token, toast]);

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
      content = replaceVariables(
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

    const key = selectedRecipient.type === 'student' ? 'student' : `parent-${selectedRecipient.id}`;
    const isEmail = selectedRecipient.method === 'email';
    
    try {
      if (isEmail) {
        setSendingEmail(prev => ({ ...prev, [key]: true }));
        
        if (linkType === 'invite') {
          const result = await fetch('/api/invites/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'student',
              id: student.id,
              token,
              customMessage: customMessage.trim(),
            }),
          });

          if (!result.ok) {
            const error = await result.json();
            throw new Error(error.error || 'Failed to send email');
          }

          setEmailSent(prev => ({ ...prev, [key]: true }));
          toast({
            title: 'Invite email sent',
            description: `An invite has been sent to ${selectedRecipient.value}`,
          });
        } else {
          const response = await fetch('/api/students/send-registration-invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              studentId: student.id,
              token,
              sendEmail: true,
              recipientType: selectedRecipient.type,
              recipientId: selectedRecipient.id,
              contactMethod: 'email',
              customMessage: customMessage.trim(),
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to send email');
          }

          setEmailSent(prev => ({ ...prev, [key]: true }));
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
    setToken(null);
    setInviteUrl(null);
    setEmailSent({});
    setSmsSent({});
    setCopied(false);
    setSendingEmail({});
    setSendingSms({});
    setCustomMessage('');
    setSelectedSenderId(null);
    setSelectedRecipient(null);
    setStudentClasses([]);
    setContactId(null);
    setComposerDraft('');
    onClose();
  };

  // Build recipient options
  const recipientOptions: Array<{ type: 'student' | 'parent'; id?: string; method: 'phone' | 'email'; label: string; value: string }> = [];
  if (student.phone) {
    recipientOptions.push({
      type: 'student',
      method: 'phone',
      label: 'Student Phone',
      value: student.phone,
    });
  }
  parents.forEach((parent) => {
    if (parent.phone) {
      recipientOptions.push({
        type: 'parent',
        id: parent.id,
        method: 'phone',
        label: `${parent.first_name} ${parent.last_name} Phone`,
        value: parent.phone,
      });
    }
  });
  if (student.email) {
    recipientOptions.push({
      type: 'student',
      method: 'email',
      label: 'Student Email',
      value: student.email,
    });
  }
  parents.forEach((parent) => {
    if (parent.email) {
      recipientOptions.push({
        type: 'parent',
        id: parent.id,
        method: 'email',
        label: `${parent.first_name} ${parent.last_name} Email`,
        value: parent.email,
      });
    }
  });

  const selectedSender = availableSenders?.find(s => s.id === selectedSenderId);
  const isIMessageSender = selectedSender?.provider === 'IMESSAGE';
  const isSMSSender = selectedSender?.provider === 'TWILIO';
  const smsSegments = isSMSSender ? calculateSMSSegments(customMessage) : null;
  const isSending = Object.values(sendingEmail).some(v => v) || Object.values(sendingSms).some(v => v);
  
  const dialogTitle = linkType === 'invite' ? 'Send Invite' : 'Send Registration Link';
  const dialogDescription = linkType === 'invite' 
    ? `Send an account creation invite to ${student.first_name} ${student.last_name}`
    : `Send a registration link to ${student.first_name} ${student.last_name} to complete registration`;

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
                <DialogTitle>{dialogTitle}</DialogTitle>
                <DialogDescription>
                  {dialogDescription}
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

              {/* Chat Window for Phone or Composer for Email */}
              {selectedRecipient && selectedRecipient.method === 'phone' ? (
                <div className="flex-1 flex flex-col min-h-0 border rounded-md overflow-hidden mx-4">
                  {/* Fixed Header with Message label and dropdown */}
                  <div className="px-3 py-2 border-b flex items-center justify-between flex-shrink-0 bg-background">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">Message</span>
                      {recipientOptions.length > 0 && (
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
                            {recipientOptions.map((option, index) => (
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
                          onBeforeSend={async (messageBody, selectedSenderId) => {
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
                <div className="space-y-2 px-4">
                  {/* Message Templates Button and Send From Button */}
                  <div className="flex items-center gap-2">
                    <MessageTemplatesPicker 
                      onSelect={handleTemplateSelect}
                      disabled={isGeneratingTokens}
                    />
                    {isGeneratingTokens && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {availableSenders && availableSenders.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            disabled={!selectedSenderId}
                            type="button"
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

                  {/* Message Composer */}
                  <div className="relative">
                    <textarea
                      ref={textareaRef}
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      className={`w-full text-sm px-3 py-2 ${
                        isSMSSender && smsSegments ? 'pr-20' : 'pr-3'
                      } border rounded-md bg-background resize-none min-h-[100px] max-h-[200px]`}
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

                  {/* Send Button */}
                  <div className="flex justify-end">
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
              ) : null}

              {recipientOptions.length === 0 && (
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

