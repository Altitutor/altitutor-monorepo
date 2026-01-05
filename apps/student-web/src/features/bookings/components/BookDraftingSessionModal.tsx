'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@altitutor/ui';
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, useToast } from '@altitutor/ui';
import { Loader2, Check } from 'lucide-react';
import { TimeSlotPicker } from './TimeSlotPicker';
import { BookingConfirmationCalendar } from './BookingConfirmationCalendar';
import { useStudentSubjects } from '../hooks/useStudentSubjects';
import { useCreateBooking } from '../hooks/useCreateBooking';
import { useMyReservations } from '../hooks/useReservations';
import { useStudentSessions } from '@/features/sessions/hooks/useSessions';
import { pricingApi } from '../api/pricing';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import type { Tables } from '@altitutor/shared';
import { cn } from '@/shared/utils';
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
  const { data: durationMinutes = 60 } = useSessionDurationMinutes('DRAFTING');

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<{ startAt: string; endAt: string; availableStaffIds: string[] } | null>(null);
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
      // Use the first available staff_id from the selected slot to avoid "No staff available" error
      const staffId = selectedSlot.availableStaffIds && selectedSlot.availableStaffIds.length > 0
        ? selectedSlot.availableStaffIds[0]
        : undefined;

      const sessionId = await createBooking.mutateAsync({
        session_type: 'DRAFTING',
        start_at: selectedSlot.startAt,
        end_at: selectedSlot.endAt,
        subject_id: selectedSubjectId,
        staff_id: staffId,
        reservation_id: activeReservation?.id,
        original_session_id: originalSessionId || undefined,
      });

      setCreatedSessionId(sessionId);
      setBookingSuccess(true);
      setCurrentStep(3); // Move to success step
      onBookingCreated?.(sessionId);
    } catch (error: any) {
      toast({
        title: 'Booking Failed',
        description: error.message || 'Failed to create booking. Please try again.',
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

  // Steps for indicator (only show 3 steps, success is not a step)
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-4">
          {/* Left side - Success message and details */}
          <div className="space-y-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="rounded-full bg-green-100 dark:bg-green-900/20 p-4">
                <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-semibold mb-2">Booking Confirmed!</h3>
                <p className="text-muted-foreground">
                  Your drafting session has been booked successfully
                </p>
              </div>
            </div>

            <div className="p-4 space-y-3">
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
            <div className="space-y-2">
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
                <Select 
                  value={selectedSubjectId} 
                  onValueChange={(value) => {
                    setSelectedSubjectId(value);
                    setSubjectError(false);
                  }}
                >
                  <SelectTrigger className={cn(subjectError && 'border-destructive')}>
                    <SelectValue placeholder="Select a subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {formatSubjectDisplay(subject)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  durationMinutes={durationMinutes}
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left side - Booking Details */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Booking Details</h3>
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
                <div className="space-y-2">
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
      <DialogContent className="w-full md:max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>
            {originalSessionId ? 'Reschedule Drafting Session' : 'Book Drafting Session'}
          </DialogTitle>
          <DialogDescription>
            {originalSessionId 
              ? 'Select a new time for your drafting session. Your original session will be marked as an absence.'
              : 'Schedule a one-on-one drafting session with a tutor'}
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator - Only show 3 steps (success is not a step) */}
        <div className="flex items-center justify-center space-x-2 px-6 py-4 border-b overflow-x-auto">
          {steps.map((step, index) => {
            // When on success step (step 3), show all steps as completed
            const isCompleted = bookingSuccess || index < currentStep;
            const isCurrent = !bookingSuccess && index === currentStep;
            
            return (
              <div key={step.id} className="flex items-center flex-shrink-0">
                <div
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium',
                    isCurrent
                      ? 'bg-primary text-primary-foreground'
                      : isCompleted
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      'w-12 h-0.5 mx-2',
                      isCompleted ? 'bg-primary' : 'bg-muted'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Current Step Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-[400px]">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">{currentStepData?.title}</h3>
          </div>
          {renderStepContent()}
        </div>

        {/* Footer with Back/Next buttons */}
        {!bookingSuccess && (
          <DialogFooter className="px-6 py-4 border-t bg-background">
            <div className="flex justify-between w-full">
              <div className="flex gap-2">
                {!isFirstStep && (
                  <Button
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
                  // Confirmation step - show Confirm Booking button
                  <Button
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
                  // Other steps - show Next button
                  <Button
                    onClick={handleNext}
                    disabled={isSubmitting || (currentStep === 0 && !selectedSubjectId) || (currentStep === 1 && !selectedSlot)}
                  >
                    Next
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        )}

        {/* Success Footer */}
        {bookingSuccess && (
          <DialogFooter className="px-6 py-4 border-t bg-background">
            <Button onClick={handleClose} className="w-full">
              Close
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
