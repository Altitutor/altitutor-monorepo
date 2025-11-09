'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@altitutor/ui';
import { useToast } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import { StudentSelector } from '@/features/messages/components/bulk/StudentSelector';
import { MessageComposer } from '@/features/messages/components/bulk/MessageComposer';
import { SendOptions } from '@/features/messages/components/bulk/SendOptions';
import { MessagePreview } from '@/features/messages/components/bulk/MessagePreview';
import { useBulkSend } from '@/features/messages/hooks/useBulkSend';

type Step = 'select' | 'compose' | 'options' | 'preview' | 'success';

export default function BulkMessagingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { sendBulkMessages, isLoading: isSending } = useBulkSend();

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
      const result = await sendBulkMessages(selectedStudents, message, sendToParents);
      setSendResult(result);
      setStep('success');
      
      toast({
        title: 'Messages sent!',
        description: `Successfully sent ${result.sent} message${result.sent !== 1 ? 's' : ''}`,
      });
    } catch (error: any) {
      console.error('Error sending bulk messages:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send messages',
        variant: 'destructive',
      });
    }
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
      { key: 'options', label: 'Options' },
      { key: 'preview', label: 'Preview' },
    ];

    const currentIndex = steps.findIndex(s => s.key === step);

    return (
      <div className="flex items-center justify-center gap-2 p-4 border-b">
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

  return (
    <div className="flex flex-col h-full">
      {step !== 'success' && renderStepIndicator()}

      {step === 'select' && (
        <StudentSelector
          selectedStudents={selectedStudents}
          onStudentsChange={setSelectedStudents}
          onNext={() => setStep('compose')}
        />
      )}

      {step === 'compose' && (
        <MessageComposer
          students={selectedStudents}
          message={message}
          onMessageChange={setMessage}
          onNext={() => setStep('options')}
          onBack={() => setStep('select')}
        />
      )}

      {step === 'options' && (
        <SendOptions
          sendToParents={sendToParents}
          onSendToParentsChange={setSendToParents}
          onNext={() => setStep('preview')}
          onBack={() => setStep('compose')}
        />
      )}

      {step === 'preview' && (
        <MessagePreview
          students={selectedStudents}
          message={message}
          sendToParents={sendToParents}
          onSend={handleSend}
          onBack={() => setStep('options')}
          isSending={isSending}
        />
      )}

      {step === 'success' && sendResult && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md text-center">
            <div className="mb-6">
              <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Messages Sent!</h2>
              <p className="text-muted-foreground">
                Your bulk messages have been queued for delivery
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
              <Button variant="outline" onClick={() => router.push('/communications')}>
                View Conversations
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



