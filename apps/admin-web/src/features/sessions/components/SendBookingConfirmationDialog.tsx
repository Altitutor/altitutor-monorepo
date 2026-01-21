'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@altitutor/ui";
import { Button } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { Loader2, Mail, MessageSquare, CheckCircle2, Copy, Check, X } from 'lucide-react';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { getBookingConfirmationUrl } from '@/shared/utils/invites';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
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
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [student, setStudent] = useState<Tables<'students'> | null>(null);
  const [parents, setParents] = useState<Array<{ id: string; first_name: string; last_name: string; email: string | null; phone: string | null }>>([]);
  const [isLoading, setIsLoading] = useState(false);

  const bookingUrl = sessionId ? getBookingConfirmationUrl(sessionId) : null;

  // Fetch student and parent data
  useEffect(() => {
    if (!isOpen || !studentId) return;

    const fetchData = async () => {
      setIsLoading(true);
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      
      // Fetch student
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .single();

      if (!studentError && studentData) {
        setStudent(studentData);
      }
      
      // Fetch parents
      const { data: parentsData, error: parentsError } = await supabase
        .from('parents_students')
        .select('parent_id, parents(id, first_name, last_name, email, phone)')
        .eq('student_id', studentId);

      if (!parentsError && parentsData) {
        const parentList = parentsData
          .map((ps: any) => ps.parents)
          .filter((p: any) => p !== null);
        setParents(parentList);
      }
      
      setIsLoading(false);
    };

    fetchData();
  }, [isOpen, studentId]);

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
    } catch (error) {
      toast({
        title: 'Failed to copy',
        description: 'Please copy the link manually',
        variant: 'destructive',
      });
    }
  };

  const handleSendEmail = async () => {
    if (!sessionId || !studentId) return;

    try {
      setIsSendingEmail(true);
      const response = await fetch('/api/sessions/send-booking-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId,
          studentId,
          sendEmail: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send email');
      }

      setEmailSent(true);
      toast({
        title: 'Email sent',
        description: 'Booking confirmation link has been sent via email',
      });
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
    if (!sessionId || !studentId) return;

    try {
      setIsSendingSms(true);
      const response = await fetch('/api/sessions/send-booking-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId,
          studentId,
          sendSms: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send SMS');
      }

      setSmsSent(true);
      toast({
        title: 'SMS sent',
        description: 'Booking confirmation link has been sent via SMS',
      });
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
    setEmailSent(false);
    setSmsSent(false);
    setCopied(false);
    onClose();
  };

  // Determine recipients (prefer parents, fallback to student)
  const recipients = parents.filter(p => p.email || p.phone);
  const hasRecipients = recipients.length > 0 || (student?.email || student?.phone);

  if (!student) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] [&>button]:hidden">
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
                  Send a booking confirmation link for this session to {student.first_name} {student.last_name}'s parent(s)
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Booking URL Display */}
          {bookingUrl && (
            <div className="space-y-2">
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
              <p className="text-xs text-muted-foreground">
                Share this link with the parent to view booking confirmation details
              </p>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
            </div>
          ) : (
            <>
              {!hasRecipients && (
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                  <p className="text-sm text-orange-800 dark:text-orange-200">
                    No email or phone number found for parents or student. Please add contact information before sending.
                  </p>
                </div>
              )}

              {hasRecipients && bookingUrl && (
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
                            disabled={isSendingEmail || emailSent}
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
                            disabled={isSendingSms || smsSent}
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
                              disabled={!student.email || isSendingEmail || emailSent}
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
                              disabled={!student.phone || isSendingSms || smsSent}
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
                        Booking confirmation link sent successfully!
                      </p>
                    </div>
                  )}
                </>
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
