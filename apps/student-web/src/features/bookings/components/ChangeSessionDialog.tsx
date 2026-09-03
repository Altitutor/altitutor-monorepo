'use client';

import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useToast,
} from '@altitutor/ui';
import { TimeSlotPicker } from './TimeSlotPicker';
import { useSessionDurationMinutes, useMinAdvanceBookingDays } from '../hooks/useBookingSettings';
import { studentBtnOutline, studentBtnPrimary } from '@/shared/lib/student-visual';
import { formatSessionType } from '@/shared/utils';
import { posthogIdentityHeaders } from '@/shared/lib/analytics/posthog';

type ChangeSessionStep = 'select' | 'review';

interface ChangeSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  sessionType: 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW';
  currentStartAt?: string;
  currentEndAt?: string;
  onChanged: (next: { start_at: string; end_at: string }) => void;
}

function formatAdelaideDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Australia/Adelaide',
  });
}

function formatAdelaideTimeRange(startAt: string, endAt: string): string {
  const start = new Date(startAt).toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Australia/Adelaide',
  });
  const end = new Date(endAt).toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Australia/Adelaide',
  });
  return `${start} - ${end}`;
}

export function ChangeSessionDialog({
  open,
  onOpenChange,
  sessionId,
  sessionType,
  currentStartAt,
  currentEndAt,
  onChanged,
}: ChangeSessionDialogProps) {
  const { toast } = useToast();
  const { data: durationMinutes = 45 } = useSessionDurationMinutes(sessionType, {
    enabled: open,
  });
  const { data: minAdvanceDays = 1 } = useMinAdvanceBookingDays({ enabled: open });
  const [step, setStep] = useState<ChangeSessionStep>('select');
  const [selectedSlot, setSelectedSlot] = useState<{
    startAt: string;
    endAt: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetDialog = () => {
    setStep('select');
    setSelectedSlot(null);
  };

  const selectedDurationMinutes = selectedSlot
    ? Math.round(
        (new Date(selectedSlot.endAt).getTime() -
          new Date(selectedSlot.startAt).getTime()) /
          (1000 * 60)
      )
    : durationMinutes;

  const handleConfirm = async () => {
    if (!selectedSlot) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/bookings/trial/${sessionId}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...posthogIdentityHeaders() },
        body: JSON.stringify({
          start_at: selectedSlot.startAt,
          end_at: selectedSlot.endAt,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof data.error === 'string' ? data.error : 'Failed to change session'
        );
      }
      onChanged({
        start_at: data.start_at ?? selectedSlot.startAt,
        end_at: data.end_at ?? selectedSlot.endAt,
      });
      toast({
        title: 'Session updated',
        description: 'A confirmation email has been sent.',
      });
      resetDialog();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Could not change session',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step === 'review') {
      setStep('select');
      return;
    }
    resetDialog();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isSubmitting) {
          if (!next) resetDialog();
          onOpenChange(next);
        }
      }}
    >
      <DialogContent className="flex max-h-[90vh] w-full flex-col overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {step === 'select' ? 'Change session' : 'Confirm new time'}
          </DialogTitle>
          <DialogDescription>
            {step === 'select'
              ? 'Choose a new date and time from the week view below.'
              : 'Review your new session time before confirming.'}
          </DialogDescription>
        </DialogHeader>

        <div className="mb-2 flex shrink-0 items-center justify-center gap-2">
          {(['select', 'review'] as const).map((stepId, index) => {
            const stepIndex = step === 'select' ? 0 : 1;
            const isCurrent = index === stepIndex;
            const isComplete = index < stepIndex;
            return (
              <div key={stepId} className="flex items-center">
                <div
                  className={
                    isCurrent
                      ? 'flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground'
                      : isComplete
                        ? 'flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-sm font-medium text-primary'
                        : 'flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground'
                  }
                >
                  {index + 1}
                </div>
                {index === 0 && (
                  <div
                    className={
                      isComplete
                        ? 'mx-2 h-0.5 w-12 bg-primary'
                        : 'mx-2 h-0.5 w-12 bg-muted'
                    }
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="min-h-[28rem] flex-1 overflow-y-auto">
          {step === 'select' ? (
            <TimeSlotPicker
              sessionType={sessionType}
              durationMinutes={durationMinutes}
              minAdvanceDays={minAdvanceDays}
              allowAnonymous
              selectedSlot={selectedSlot}
              onSlotSelect={(startAt, endAt) => setSelectedSlot({ startAt, endAt })}
            />
          ) : selectedSlot ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Booking Details</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="text-sm font-medium text-muted-foreground">Session:</div>
                <div className="text-sm">{formatSessionType(sessionType)}</div>

                {currentStartAt && currentEndAt && (
                  <>
                    <div className="text-sm font-medium text-muted-foreground">Current:</div>
                    <div className="text-sm text-muted-foreground">
                      {formatAdelaideDate(currentStartAt)}
                      <br />
                      {formatAdelaideTimeRange(currentStartAt, currentEndAt)}
                    </div>
                  </>
                )}

                <div className="text-sm font-medium text-muted-foreground">New date:</div>
                <div className="text-sm">{formatAdelaideDate(selectedSlot.startAt)}</div>

                <div className="text-sm font-medium text-muted-foreground">New time:</div>
                <div className="text-sm">
                  {formatAdelaideTimeRange(selectedSlot.startAt, selectedSlot.endAt)}
                </div>

                <div className="text-sm font-medium text-muted-foreground">Duration:</div>
                <div className="text-sm">{selectedDurationMinutes} minutes</div>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className={studentBtnOutline}
            disabled={isSubmitting}
            onClick={handleBack}
          >
            Back
          </Button>
          {step === 'select' ? (
            <Button
              type="button"
              className={studentBtnPrimary}
              disabled={!selectedSlot}
              onClick={() => setStep('review')}
            >
              Next
            </Button>
          ) : (
            <Button
              type="button"
              className={studentBtnPrimary}
              disabled={!selectedSlot || isSubmitting}
              onClick={handleConfirm}
            >
              {isSubmitting ? 'Saving…' : 'Confirm new time'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
