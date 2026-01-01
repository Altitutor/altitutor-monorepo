'use client';

import { useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@altitutor/ui';
import { useToast } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import { StudentSelector } from '../bulk/StudentSelector';
import { MessageComposer } from '../bulk/MessageComposer';
import { MessagePreview } from '../bulk/MessagePreview';
import { useAnnouncements } from '@/features/messages/hooks/useAnnouncements';

type Step = 'select' | 'compose' | 'preview' | 'success';

interface AnnouncementsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AnnouncementsModal({ isOpen, onClose }: AnnouncementsModalProps) {
  const { toast } = useToast();
  const { sendAnnouncements, isLoading: isSending } = useAnnouncements();

  const [step, setStep] = useState<Step>('select');
  const [selectedStudents, setSelectedStudents] = useState<Tables<'students'>[]>([]);
  const [message, setMessage] = useState('');
  const [sendToParents, setSendToParents] = useState(false);
  const [sendResult, setSendResult] = useState<{
    sent: number;
    failed: number;
    skipped: number;
  } | null>(null);

  const handleSend = async () => {
    try {
      const result = await sendAnnouncements(selectedStudents, message, sendToParents);
      setSendResult(result);
      setStep('success');
      
      toast({
        title: 'Announcements sent!',
        description: `Successfully sent ${result.sent} announcement${result.sent !== 1 ? 's' : ''}`,
      });
    } catch (error: any) {
      console.error('Error sending announcements:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send announcements',
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
    setSendResult(null);
    onClose();
  };

  const handleReset = () => {
    setStep('select');
    setSelectedStudents([]);
    setMessage('');
    setSendToParents(false);
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
      <DialogContent className="max-w-4xl h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>{getStepTitle()}</DialogTitle>
        </DialogHeader>
        
        {step !== 'success' && renderStepIndicator()}

        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-[400px]">
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
              onNext={() => setStep('preview')}
              onBack={() => setStep('select')}
            />
          )}

          {step === 'preview' && (
            <MessagePreview
              students={selectedStudents}
              message={message}
              sendToParents={sendToParents}
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
