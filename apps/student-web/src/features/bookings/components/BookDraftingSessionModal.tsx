'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@altitutor/ui';
import { Button, SearchableSelect, useToast } from '@altitutor/ui';
import { Loader2, Check } from 'lucide-react';
import { TimeSlotPicker } from './TimeSlotPicker';
import { BookingConfirmationCalendar } from './BookingConfirmationCalendar';
import { useStudentSubjects } from '../hooks/useStudentSubjects';
import { useCreateBooking } from '../hooks/useCreateBooking';
import { useMyReservations } from '../hooks/useReservations';
import { useStudentSessions } from '@/shared/hooks';
import { pricingApi } from '../api/pricing';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import type { Tables } from '@altitutor/shared';
import { cn, getErrorMessage } from '@/shared/utils';
import {
  studentBtnOutline,
  studentBtnPrimary,
  studentCardCn,
  studentModalFooter,
  studentModalHairline,
  studentModalShell,
} from '@/shared/lib/student-visual';
import { useSessionDurationMinutes } from '../hooks/useBookingSettings';
export interface BookDraftingSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBookingCreated?: (sessionId: string) => void;
  originalSessionId?: string | null; // Optional: if provided, this is a reschedule operation
  originalSubjectId?: string | null; // Optional: subject ID from the original session (for reschedule)
}

export function BookDraftingSessionModal({
  isOpen,
  onClose,
  onBookingCreated,
  originalSessionId = null,
  originalSubjectId = null,
}: BookDraftingSessionModalProps) {
  const { toast } = useToast();
  const { data: subjects, isLoading: subjectsLoading } = useStudentSubjects();
  const { data: reservations } = useMyReservations();
  const createBooking = useCreateBooking();

  // Get default drafting session duration from booking settings
  const { data: defaultDurationMinutes = 60 } = useSessionDurationMinutes('DRAFTING');

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<{ startAt: string; endAt: string; availableStaffIds: string[] } | null>(null);
  
  // Calculate duration from selected slot, default to booking settings value if no slot selected
  const durationMinutes = selectedSlot
    ? Math.round((new Date(selectedSlot.endAt).getTime() - new Date(selectedSlot.startAt).getTime()) / (1000 * 60))
    : defaultDurationMinutes;
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);
  const [subjectError, setSubjectError] = useState(false);
  const [timeError, setTimeError] = useState(false);

  // Auto-select subject from original session when rescheduling
  useEffect(() => {
    if (isOpen && originalSubjectId && subjects) {
      // Verify the subject is still available to the student
      const subjectExists = subjects.some(s => s.id === originalSubjectId);
      if (subjectExists && !selectedSubjectId) {
        // Only set if not already selected (to avoid overriding user selection)
        setSelectedSubjectId(originalSubjectId);
        // Auto-advance to time selection step if subject is pre-selected
        setCurrentStep(1);
      }
    }
  }, [isOpen, originalSubjectId, subjects, selectedSubjectId]);

  // Get the active reservation for the selected slot
  const activeReservation = reservations?.find(
    (r) => r.start_at === selectedSlot?.startAt && r.end_at === selectedSlot?.endAt
  );

  const handleSlotSelect = (startAt: string, endAt: string, availableStaffIds: string[]) => {
    setSelectedSlot({ startAt, endAt, availableStaffIds });
    // Don't auto-proceed - user must click Next
  };

  const handleClose = () => {
    if (isSubmitting) return;
    
    // Reset state
    setCurrentStep(0);
    setSelectedSubjectId('');
    setSelectedSlot(null);
    setBookingSuccess(false);
    setCreatedSessionId(null);
    setSubjectError(false);
    setTimeError(false);
    onClose();
  };

  const handleNext = () => {
    if (currentStep === 0) {
      // From subject selection to time selection
      if (!selectedSubjectId) {
        setSubjectError(true);
        toast({
          title: 'Please select a subject',
          description: 'You must select a subject before continuing',
          variant: 'destructive',
        });
        return;
      }
      setSubjectError(false);
      setCurrentStep(1);
    } else if (currentStep === 1) {
      // From time selection to confirmation
      if (!selectedSlot) {
        setTimeError(true);
        toast({
          title: 'Please select a time slot',
          description: 'You must select a time slot before continuing',
          variant: 'destructive',
        });
        return;
      }
      setTimeError(false);
      setCurrentStep(2);
    }
  };

  const handleBack = () => {
    if (currentStep > 0 && !bookingSuccess) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleConfirmBooking = async () => {
    if (!selectedSlot || !selectedSubjectId) {
      toast({
        title: 'Missing Information',
        description: 'Please select a subject and time slot',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Validate that staff is still available before booking
      if (!selectedSlot.availableStaffIds || selectedSlot.availableStaffIds.length === 0) {
        toast({
          title: 'Slot No Longer Available',
          description: 'This time slot is no longer available. Please select another time.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      // Don't pass staff_id - let the database function auto-assign based on current availability
      // This ensures we get the most up-to-date staff availability
      const sessionId = await createBooking.mutateAsync({
        session_type: 'DRAFTING',
        start_at: selectedSlot.startAt,
        end_at: selectedSlot.endAt,
        subject_id: selectedSubjectId,
        staff_id: undefined, // Let function auto-assign
        reservation_id: activeReservation?.id,
        original_session_id: originalSessionId || undefined,
      });

      setCreatedSessionId(sessionId);

      setBookingSuccess(true);
      setCurrentStep(3); // Move to success step
      onBookingCreated?.(sessionId);
    } catch (error: unknown) {
      toast({
        title: 'Booking Failed',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatSubjectDisplay = (subject: Tables<'subjects'>) => {
    const parts = [
      subject.curriculum,
      subject.year_level ? `Year ${subject.year_level}` : '',
      subject.name,
    ].filter(Boolean);
    return parts.join(' ');
  };

  // Steps for indicator (only show 4 steps, success is not a step)
  const steps = [
    { id: 'subject', title: 'Select Subject' },
    { id: 'time', title: 'Select Time' },
    { id: 'confirm', title: 'Confirm Booking' },
  ];

  // Get sessions for the selected day (for calendar display)
  const sessionDate = selectedSlot ? new Date(selectedSlot.startAt) : new Date();
  const dayStart = new Date(sessionDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(sessionDate);
  dayEnd.setHours(23, 59, 59, 999);

  const { data: daySessions } = useStudentSessions(
    format(dayStart, 'yyyy-MM-dd'),
    format(dayEnd, 'yyyy-MM-dd')
  );

  // Get pricing for the selected session
  const { data: sessionPrice } = useQuery({
    queryKey: ['session-price', selectedSubjectId, selectedSlot?.startAt, selectedSlot?.endAt],
    queryFn: () => {
      if (!selectedSlot || !selectedSubjectId) return null;
      return pricingApi.calculateDraftingSessionPrice(
        selectedSubjectId,
        selectedSlot.startAt,
        selectedSlot.endAt
      );
    },
    enabled: !!selectedSlot && !!selectedSubjectId && currentStep >= 2,
  });

  // Get the created session details for success step (to show staff info)
  const bookedSession = createdSessionId && daySessions
    ? daySessions.find(s => s.session_id === createdSessionId)
    : null;

  const currentStepData = steps[currentStep];
  const isFirstStep = currentStep === 0;

  const renderStepContent = () => {
    if (bookingSuccess && currentStep === 3) {
      const subject = subjects?.find((s) => s.id === selectedSubjectId);
      return (
        <div className="grid grid-cols-1 gap-6 py-2 lg:grid-cols-2">
          {/* Left side - Success message and details */}
          <div className="space-y-6">
            <div className="space-y-4 rounded-2xl bg-emerald-500/[0.08] p-6 text-center ring-1 ring-emerald-500/20 dark:bg-emerald-500/10">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/30">
                <Check className="h-7 w-7 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="mb-2 text-xl font-semibold tracking-tight">Booking Confirmed!</h3>
                <p className="text-muted-foreground">
                  Your drafting session has been booked successfully
                </p>
              </div>
            </div>

            <div className={studentCardCn('space-y-3 p-5')}>
              <h4 className="font-semibold">Booking Details</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {subject && (
                  <>
                    <div className="text-muted-foreground font-medium">Subject:</div>
                    <div>{formatSubjectDisplay(subject)}</div>
                  </>
                )}
                <div className="text-muted-foreground font-medium">Date & Time:</div>
                <div>
                  {selectedSlot && new Date(selectedSlot.startAt).toLocaleString('en-AU', {
                    dateStyle: 'long',
                    timeStyle: 'short',
                    timeZone: 'Australia/Adelaide',
                  })}
                </div>
                <div className="text-muted-foreground font-medium">Duration:</div>
                <div>{durationMinutes} minutes</div>
              </div>
            </div>
          </div>

          {/* Right side - Calendar */}
          {selectedSlot && (
            <div className="space-y-3">
              <h4 className="font-semibold">Session in Calendar</h4>
              <BookingConfirmationCalendar
                newSession={{
                  start_at: selectedSlot.startAt,
                  end_at: selectedSlot.endAt,
                  type: 'DRAFTING',
                  subject_id: selectedSubjectId || null,
                  subject: subject || null,
                  staff: bookedSession?.staff || [],
                }}
                existingSessions={(daySessions || []).filter(s => s.session_id !== createdSessionId)}
              />
            </div>
          )}
        </div>
      );
    }

    switch (currentStepData?.id) {
      case 'subject':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choose the subject for your drafting session
            </p>
            {subjectsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !subjects || subjects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No subjects found. Please contact support to add subjects to your account.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <SearchableSelect<Tables<'subjects'>>
                  items={subjects}
                  value={subjects.find((s) => s.id === selectedSubjectId) ?? null}
                  onValueChange={(item) => {
                    if (item) {
                      setSelectedSubjectId(item.id);
                      setSubjectError(false);
                    }
                  }}
                  getItemLabel={formatSubjectDisplay}
                  getItemId={(s) => s.id}
                  placeholder="Select a subject"
                  triggerClassName={cn(subjectError && 'border-destructive')}
                />
                {subjectError && (
                  <p className="text-sm text-destructive">
                    Please select a subject to continue
                  </p>
                )}
              </div>
            )}
          </div>
        );

      case 'time':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choose an available time slot for your drafting session
            </p>
            {selectedSubjectId ? (
              <div className="space-y-2">
                <TimeSlotPicker
                  sessionType="DRAFTING"
                  subjectId={selectedSubjectId}
                  durationMinutes={defaultDurationMinutes}
                  onSlotSelect={(startAt, endAt, availableStaffIds) => {
                    handleSlotSelect(startAt, endAt, availableStaffIds);
                    setTimeError(false);
                  }}
                  selectedSlot={selectedSlot}
                />
                {timeError && (
                  <p className="text-sm text-destructive">
                    Please select a time slot to continue
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Please select a subject first</p>
              </div>
            )}
          </div>
        );

      case 'confirm':
        return (
          <div className="space-y-4">
            {selectedSlot && selectedSubjectId ? (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Left side - Booking Details */}
                <div className={studentCardCn('space-y-4 p-5')}>
                  <div>
                    <h3 className="mb-4 text-lg font-semibold tracking-tight">Booking Details</h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      {(() => {
                        const subject = subjects?.find((s) => s.id === selectedSubjectId);
                        return subject ? (
                          <>
                            <div className="text-sm font-medium text-muted-foreground">Subject:</div>
                            <div className="text-sm">{formatSubjectDisplay(subject)}</div>
                          </>
                        ) : null;
                      })()}
                      
                      <div className="text-sm font-medium text-muted-foreground">Date & Time:</div>
                      <div className="text-sm">
                        {new Date(selectedSlot.startAt).toLocaleString('en-AU', {
                          dateStyle: 'long',
                          timeStyle: 'short',
                          timeZone: 'Australia/Adelaide',
                        })}
                      </div>
                      
                      <div className="text-sm font-medium text-muted-foreground">Duration:</div>
                      <div className="text-sm">{durationMinutes} minutes</div>

                      {sessionPrice && (
                        <>
                          <div className="text-sm font-medium text-muted-foreground">Price:</div>
                          <div className="text-sm font-semibold">
                            ${(sessionPrice.amount_cents / 100).toFixed(2)} {sessionPrice.currency.toUpperCase()}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                </div>

                {/* Right side - Calendar */}
                <div className="space-y-3">
                  <h4 className="font-semibold">Session in Calendar</h4>
                  <BookingConfirmationCalendar
                    newSession={{
                      start_at: selectedSlot.startAt,
                      end_at: selectedSlot.endAt,
                      type: 'DRAFTING',
                      subject_id: selectedSubjectId || null,
                      subject: subjects?.find((s) => s.id === selectedSubjectId) || null,
                      staff: [], // Will be populated after booking
                    }}
                    existingSessions={daySessions || []}
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Please complete the previous steps</p>
              </div>
            )}
          </div>
        );

      default:
        return <div>Unknown step</div>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className={cn(
          studentModalShell,
          'flex h-[90vh] max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-[100vw] flex-col gap-0 overflow-hidden rounded-2xl border-0 p-0 sm:w-full md:max-w-4xl',
          '[&>button]:rounded-xl [&>button]:hover:bg-muted/80',
        )}
      >
        <DialogHeader className="shrink-0 space-y-1.5 px-6 pb-5 pt-6 text-left">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {originalSessionId ? 'Reschedule Drafting Session' : 'Book Drafting Session'}
          </DialogTitle>
          <DialogDescription>
            {originalSessionId
              ? 'Select a new time for your drafting session. Your original session will be marked as an absence.'
              : 'Schedule a one-on-one drafting session with a tutor'}
          </DialogDescription>

          {/* Step indicator (1–3); success step still shows all as completed */}
          <div
            className="flex items-center justify-center overflow-x-auto border-t border-black/[0.07] pt-5 dark:border-white/10"
            aria-label="Booking progress"
          >
            {steps.map((step, index) => {
              const isCompleted = bookingSuccess || index < currentStep;
              const isCurrent = !bookingSuccess && index === currentStep;

              return (
                <div key={step.id} className="flex shrink-0 items-center">
                  <div
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-xl text-sm font-medium transition-colors duration-300',
                      isCurrent
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : isCompleted
                          ? 'bg-primary/15 text-primary ring-1 ring-primary/20'
                          : 'bg-muted text-muted-foreground ring-1 ring-black/[0.06] dark:ring-white/10',
                    )}
                  >
                    {index + 1}
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={cn(
                        'mx-2 h-0.5 w-12 rounded-full transition-colors duration-300',
                        isCompleted ? 'bg-primary/40' : 'bg-muted',
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </DialogHeader>

        <div className={cn(studentModalHairline)} />

        {/* Current Step Content */}
        <div className="min-h-0 flex-1 overflow-hidden px-6 py-4">
          <div className="h-full overflow-y-auto">
            <div className="mb-4">
              <h3 className="text-lg font-semibold tracking-tight">{currentStepData?.title}</h3>
            </div>
            {renderStepContent()}
          </div>
        </div>

        {!bookingSuccess && (
          <div className={cn(studentModalFooter)}>
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                {!isFirstStep && (
                  <Button
                    className={studentBtnOutline}
                    variant="outline"
                    onClick={handleBack}
                    disabled={isSubmitting}
                  >
                    Back
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {currentStep === 2 ? (
                  <Button
                    className={studentBtnPrimary}
                    onClick={handleConfirmBooking}
                    disabled={isSubmitting || !selectedSlot || !selectedSubjectId}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Confirming...
                      </>
                    ) : (
                      'Confirm Booking'
                    )}
                  </Button>
                ) : (
                  <Button
                    className={studentBtnPrimary}
                    onClick={handleNext}
                    disabled={
                      isSubmitting ||
                      (currentStep === 0 && !selectedSubjectId) ||
                      (currentStep === 1 && !selectedSlot)
                    }
                  >
                    Next
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {bookingSuccess && (
          <div className={cn(studentModalFooter, 'justify-end')}>
            <Button className={cn(studentBtnPrimary, 'w-full sm:w-auto')} onClick={handleClose}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
