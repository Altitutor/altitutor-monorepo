'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@altitutor/ui";
import { Button } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { Loader2, Mail, MessageSquare, CheckCircle2, Copy, Check } from 'lucide-react';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
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
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [parents, setParents] = useState<Array<{ id: string; first_name: string; last_name: string; email: string | null; phone: string | null }>>([]);

  // Fetch parent data
  useEffect(() => {
    if (!isOpen || !student.id) return;

    const fetchData = async () => {
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      
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
  }, [isOpen, student.id]);

  const handleGenerateToken = useCallback(async () => {
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
        const baseUrl = process.env.NEXT_PUBLIC_STUDENT_URL || 'http://localhost:3001';
        const url = `${baseUrl}/invite/${result.token}`;
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
        const baseUrl = process.env.NEXT_PUBLIC_STUDENT_URL || 'http://localhost:3001';
        const url = `${baseUrl}/register/${result.token}`;
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
  }, [student.id, linkType, toast]);

  // Generate token when modal opens (or reuse existing one)
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

  const handleSendEmail = async () => {
    if (!token) return;

    try {
      setIsSendingEmail(true);
      
      if (linkType === 'invite') {
        const result = await fetch('/api/invites/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'student',
            id: student.id,
            token,
          }),
        });

        if (!result.ok) {
          const error = await result.json();
          throw new Error(error.error || 'Failed to send email');
        }

        setEmailSent(true);
        toast({
          title: 'Invite email sent',
          description: `An invite has been sent to ${student.email || 'the parent(s)'}`,
        });
      } else {
        const response = await fetch('/api/students/send-registration-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            studentId: student.id,
            token,
            sendEmail: true,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to send email');
        }

        setEmailSent(true);
        toast({
          title: 'Registration email sent',
          description: 'The registration link has been sent via email',
        });
      }
    } catch (error) {
      console.error('Failed to send email:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send email',
        variant: 'destructive',
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleSendSms = async () => {
    if (!token) return;

    try {
      setIsSendingSms(true);
      
      if (linkType === 'invite') {
        await fetch('/api/invites/send-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'student',
            id: student.id,
            token,
          }),
        });

        setSmsSent(true);
        toast({
          title: 'Invite SMS sent',
          description: `An invite has been sent to ${student.phone || 'the parent(s)'}`,
        });
      } else {
        const response = await fetch('/api/students/send-registration-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            studentId: student.id,
            token,
            sendSms: true,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          const errorMessage = error.error || 'Failed to send SMS';
          const errorDetails = error.details ? ` Details: ${error.details.join('; ')}` : '';
          console.error('SMS send error:', error);
          throw new Error(errorMessage + errorDetails);
        }

        setSmsSent(true);
        toast({
          title: 'Registration SMS sent',
          description: 'The registration link has been sent via SMS',
        });
      }
    } catch (error) {
      console.error('Failed to send SMS:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send SMS',
        variant: 'destructive',
      });
    } finally {
      setIsSendingSms(false);
    }
  };

  const handleClose = () => {
    setToken(null);
    setInviteUrl(null);
    setEmailSent(false);
    setSmsSent(false);
    setCopied(false);
    onClose();
  };

  // Determine recipients (prefer parents, fallback to student)
  const recipients = parents.filter(p => p.email || p.phone);
  const hasRecipients = recipients.length > 0 || (student.email || student.phone);
  
  const dialogTitle = linkType === 'invite' ? 'Send Invite' : 'Send Registration Link';
  const dialogDescription = linkType === 'invite' 
    ? `Send an account creation invite to ${student.first_name} ${student.last_name}`
    : `Send a registration link to ${student.first_name} ${student.last_name}'s parent(s) to complete registration`;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>
            {dialogDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Invite URL Display */}
          {isGenerating ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Generating {linkType === 'invite' ? 'invite' : 'registration'} link...
              </span>
            </div>
          ) : inviteUrl && (
            <div className="space-y-2">
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
              <p className="text-xs text-muted-foreground">
                {linkType === 'invite' 
                  ? `Share this link with ${student.first_name} to create their account`
                  : 'Share this link with the parent to complete student registration'}
              </p>
            </div>
          )}

          {!hasRecipients && (
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <p className="text-sm text-orange-800 dark:text-orange-200">
                No email or phone number found for parents or student. Please add contact information before sending.
              </p>
            </div>
          )}

          {hasRecipients && token && (
            <>
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Send via:</h4>
                
                {/* Email Options for Parents */}
                {recipients.map((parent) => (
                  parent.email && (
                    <div key={parent.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Mail className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{parent.first_name} {parent.last_name}</p>
                          <p className="text-sm text-muted-foreground">{parent.email}</p>
                        </div>
                      </div>
                      <Button
                        onClick={handleSendEmail}
                        disabled={isSendingEmail || isGenerating || emailSent}
                        size="sm"
                      >
                        {isSendingEmail ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Sending...
                          </>
                        ) : emailSent ? (
                          <>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Sent
                          </>
                        ) : (
                          'Send Email'
                        )}
                      </Button>
                    </div>
                  )
                ))}

                {/* SMS Options for Parents */}
                {recipients.map((parent) => (
                  parent.phone && (
                    <div key={parent.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <MessageSquare className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{parent.first_name} {parent.last_name}</p>
                          <p className="text-sm text-muted-foreground">{parent.phone}</p>
                        </div>
                      </div>
                      <Button
                        onClick={handleSendSms}
                        disabled={isSendingSms || isGenerating || smsSent}
                        size="sm"
                      >
                        {isSendingSms ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Sending...
                          </>
                        ) : smsSent ? (
                          <>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Sent
                          </>
                        ) : (
                          'Send SMS'
                        )}
                      </Button>
                    </div>
                  )
                ))}

                {/* Fallback to student if no parents */}
                {recipients.length === 0 && (
                  <>
                    {student.email && (
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Mail className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">Student Email</p>
                            <p className="text-sm text-muted-foreground">{student.email}</p>
                          </div>
                        </div>
                        <Button
                          onClick={handleSendEmail}
                          disabled={!student.email || isSendingEmail || isGenerating || emailSent}
                          size="sm"
                        >
                          {isSendingEmail ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Sending...
                            </>
                          ) : emailSent ? (
                            <>
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Sent
                            </>
                          ) : (
                            'Send Email'
                          )}
                        </Button>
                      </div>
                    )}
                    {student.phone && (
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <MessageSquare className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">Student Phone</p>
                            <p className="text-sm text-muted-foreground">{student.phone}</p>
                          </div>
                        </div>
                        <Button
                          onClick={handleSendSms}
                          disabled={!student.phone || isSendingSms || isGenerating || smsSent}
                          size="sm"
                        >
                          {isSendingSms ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Sending...
                            </>
                          ) : smsSent ? (
                            <>
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Sent
                            </>
                          ) : (
                            'Send SMS'
                          )}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {(emailSent || smsSent) && (
                <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    {linkType === 'invite' 
                      ? `Invite sent successfully! ${student.first_name} can now create their account using the link.`
                      : 'Registration link sent successfully! The parent can now complete the student\'s registration.'}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

