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
import { invitesApi } from '@/features/auth/api/invites';
import type { Tables } from '@altitutor/shared';

interface SendInviteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  student: Tables<'students'>;
}

export function SendInviteDialog({
  isOpen,
  onClose,
  student,
}: SendInviteDialogProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [copied, setCopied] = useState(false);

  const hasEmail = !!student.email;
  const hasPhone = !!student.phone;

  const handleGenerateToken = useCallback(async () => {
    try {
      setIsGenerating(true);
      const result = await invitesApi.generateInviteToken({
        type: 'student',
        id: student.id,
      });
      setToken(result.token);
      
      // Build the invite URL for student-web
      const baseUrl = process.env.NEXT_PUBLIC_STUDENT_URL || 'http://localhost:3001';
      const url = `${baseUrl}/invite/${result.token}`;
      setInviteUrl(url);
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
  }, [student.id, toast]);

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

  const handleSendEmail = async () => {
    if (!token) return;

    try {
      setIsSendingEmail(true);
      const result = await invitesApi.sendInviteEmail({
        type: 'student',
        id: student.id,
        token,
      });
      setEmailSent(true);
      toast({
        title: 'Invite email sent',
        description: `An invite has been sent to ${student.email}`,
      });
    } catch (error) {
      console.error('Failed to send email:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send invite email',
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
      await invitesApi.sendInviteSms({
        type: 'student',
        id: student.id,
        token,
      });
      setSmsSent(true);
      toast({
        title: 'Invite SMS sent',
        description: `An invite has been sent to ${student.phone}`,
      });
    } catch (error) {
      console.error('Failed to send SMS:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send invite SMS',
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

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Send Invite</DialogTitle>
          <DialogDescription>
            Send an account creation invite to {student.first_name} {student.last_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Invite URL Display */}
          {isGenerating ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Generating invite link...</span>
            </div>
          ) : inviteUrl && (
            <div className="space-y-2">
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
              <p className="text-xs text-muted-foreground">
                Share this link with {student.first_name} to create their account
              </p>
            </div>
          )}

          {!hasEmail && !hasPhone && (
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <p className="text-sm text-orange-800 dark:text-orange-200">
                This student has no email or phone number set. Please add contact information in the Details tab before sending an invite.
              </p>
            </div>
          )}

          {(hasEmail || hasPhone) && token && (
            <>
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Or send via:</h4>
                
                {/* Email Option */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Email</p>
                      {hasEmail ? (
                        <p className="text-sm text-muted-foreground">{student.email}</p>
                      ) : (
                        <p className="text-sm text-orange-600">No email address</p>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={handleSendEmail}
                    disabled={!hasEmail || isSendingEmail || isGenerating || emailSent}
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

                {/* SMS Option */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">SMS</p>
                      {hasPhone ? (
                        <p className="text-sm text-muted-foreground">{student.phone}</p>
                      ) : (
                        <p className="text-sm text-orange-600">No phone number</p>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={handleSendSms}
                    disabled={!hasPhone || isSendingSms || isGenerating || smsSent}
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
              </div>

              {(emailSent || smsSent) && (
                <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Invite sent successfully! {student.first_name} can now create their account using the link.
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

