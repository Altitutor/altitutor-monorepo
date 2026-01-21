'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@altitutor/ui';
import { useToast } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import { getErrorMessage } from '@/shared/utils';
import { StudentSelector } from '../bulk/StudentSelector';
import { MessageComposer } from '../bulk/MessageComposer';
import { MessagePreview } from '../bulk/MessagePreview';
import { useAnnouncements } from '@/features/messages/hooks/useAnnouncements';
import { useAvailableSenders } from '@/features/messages/api/queries';

type Step = 'select' | 'compose' | 'preview' | 'success';

interface AnnouncementsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AnnouncementsModal({ isOpen, onClose }: AnnouncementsModalProps) {
  const { toast } = useToast();
  const { sendAnnouncements, isLoading: isSending } = useAnnouncements();
  const { data: availableSenders, isLoading: isLoadingSenders } = useAvailableSenders();

  const [step, setStep] = useState<Step>('select');
  const [selectedStudents, setSelectedStudents] = useState<Tables<'students'>[]>([]);
  const [message, setMessage] = useState('');
  const [sendToParents, setSendToParents] = useState(false);
  const [selectedSenderId, setSelectedSenderId] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<{
    sent: number;
    failed: number;
    skipped: number;
  } | null>(null);

  // Set default sender when senders load
  useEffect(() => {
    if (availableSenders && availableSenders.length > 0 && !selectedSenderId) {
      const defaultSender = availableSenders.find(s => s.is_default) || availableSenders[0];
      setSelectedSenderId(defaultSender.id);
    }
  }, [availableSenders, selectedSenderId]);

  const handleSend = async () => {
    if (!selectedSenderId) {
      toast({
        title: 'Error',
        description: 'Please select a sender',
        variant: 'destructive',
      });
      return;
    }
    try {
      const result = await sendAnnouncements(selectedStudents, message, sendToParents, selectedSenderId);
      setSendResult(result);
      setStep('success');
      
      toast({
        title: 'Announcements sent!',
        description: `Successfully sent ${result.sent} announcement${result.sent !== 1 ? 's' : ''}`,
      });
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      console.error('Error sending announcements:', error);
      toast({
        title: 'Error',
        description: errorMessage || 'Failed to send announcements',
        variant: 'destructive',
      });
    }
  };

  const handleClose = () => {
    // Reset state when closing
    setStep('select');
    setSelectedStudents([]);
    setMessage('');
    setSendToParents(false);
    setSelectedSenderId(null);
    setSendResult(null);
    onClose();
  };

  const handleReset = () => {
    setStep('select');
    setSelectedStudents([]);
    setMessage('');
    setSendToParents(false);
    setSelectedSenderId(null);
    setSendResult(null);
  };

  const renderStepIndicator = () => {
    const steps = [
      { key: 'select', label: 'Select Students' },
      { key: 'compose', label: 'Compose' },
      { key: 'preview', label: 'Preview' },
    ];

    const currentIndex = steps.findIndex(s => s.key === step);

    return (
      <div className="flex items-center justify-center gap-2 px-6 py-4 border-b">
        {steps.map((s, index) => (
          <div key={s.key} className="flex items-center">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                index <= currentIndex
                  ? 'bg-brand-lightBlue text-brand-dark-bg'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {index + 1}
            </div>
            <span
              className={`ml-2 text-sm ${
                index <= currentIndex ? 'text-foreground font-medium' : 'text-muted-foreground'
              }`}
            >
              {s.label}
            </span>
            {index < steps.length - 1 && (
              <div className="w-12 h-0.5 bg-border mx-2" />
            )}
          </div>
        ))}
      </div>
    );
  };

  const getStepTitle = () => {
    const titles: Record<Step, string> = {
      select: 'Select Students',
      compose: 'Compose',
      preview: 'Preview',
      success: 'Success',
    };
    return titles[step] || 'Make Announcement';
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-full md:max-w-4xl h-[90vh] flex flex-col p-0 [&>button]:hidden">
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
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
                <DialogTitle>{getStepTitle()}</DialogTitle>
              </div>
            </div>
          </div>
        </DialogHeader>
        
        {step !== 'success' && (
          <div className="flex-shrink-0">
            {renderStepIndicator()}
          </div>
        )}

        <div className="flex-1 overflow-hidden min-h-0 px-6 py-4">
          <div className="h-full overflow-y-auto">
            {step === 'select' && (
            <StudentSelector
              selectedStudents={selectedStudents}
              onStudentsChange={setSelectedStudents}
              sendToParents={sendToParents}
              onSendToParentsChange={setSendToParents}
              onNext={() => setStep('compose')}
            />
          )}

          {step === 'compose' && (
            <MessageComposer
              students={selectedStudents}
              message={message}
              onMessageChange={setMessage}
              availableSenders={availableSenders || []}
              selectedSenderId={selectedSenderId}
              onSenderChange={setSelectedSenderId}
              isLoadingSenders={isLoadingSenders}
              onNext={() => setStep('preview')}
              onBack={() => setStep('select')}
            />
          )}

          {step === 'preview' && (
            <MessagePreview
              students={selectedStudents}
              message={message}
              sendToParents={sendToParents}
              selectedSender={availableSenders?.find(s => s.id === selectedSenderId) || null}
              onSend={handleSend}
              onBack={() => setStep('compose')}
              isSending={isSending}
            />
          )}

          {step === 'success' && sendResult && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="max-w-md text-center">
                <div className="mb-6">
                  <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold mb-2">Announcements Sent!</h2>
                  <p className="text-muted-foreground">
                    Your announcements have been queued for delivery
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="border rounded-lg p-4">
                    <div className="text-2xl font-bold text-green-600">{sendResult.sent}</div>
                    <div className="text-sm text-muted-foreground">Sent</div>
                  </div>
                  {sendResult.failed > 0 && (
                    <div className="border rounded-lg p-4">
                      <div className="text-2xl font-bold text-red-600">{sendResult.failed}</div>
                      <div className="text-sm text-muted-foreground">Failed</div>
                    </div>
                  )}
                  {sendResult.skipped > 0 && (
                    <div className="border rounded-lg p-4">
                      <div className="text-2xl font-bold text-yellow-600">{sendResult.skipped}</div>
                      <div className="text-sm text-muted-foreground">Skipped</div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 justify-center">
                  <Button onClick={handleReset}>
                    Send Another
                  </Button>
                  <Button variant="outline" onClick={handleClose}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>

        {step !== 'success' && (
          <div className="flex justify-between px-6 py-4 border-t bg-background">
            <Button
              variant="outline"
              onClick={() => {
                if (step === 'compose') setStep('select');
                else if (step === 'preview') setStep('compose');
              }}
              disabled={step === 'select'}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            {step === 'preview' ? (
              <Button
                onClick={handleSend}
                disabled={isSending}
              >
                {isSending ? 'Sending...' : 'Send Announcements'}
              </Button>
            ) : step === 'select' ? (
              <Button
                onClick={() => setStep('compose')}
                disabled={selectedStudents.length === 0}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : step === 'compose' ? (
              <Button
                onClick={() => setStep('preview')}
                disabled={!message.trim()}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <div></div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
