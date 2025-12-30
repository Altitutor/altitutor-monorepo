'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookingFlow } from '@/features/bookings/components/BookingFlow';
import { TimeSlotPicker } from '@/features/bookings/components/TimeSlotPicker';
import { useStudentSubjects } from '@/features/bookings/hooks/useStudentSubjects';
import { useCreateBooking } from '@/features/bookings/hooks/useCreateBooking';
import { useMyReservations } from '@/features/bookings/hooks/useReservations';
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, useToast } from '@altitutor/ui';
import { Loader2 } from 'lucide-react';
import type { Tables } from '@altitutor/shared';

export default function BookDraftingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: subjects, isLoading: subjectsLoading } = useStudentSubjects();
  const { data: reservations } = useMyReservations();
  const createBooking = useCreateBooking();

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<{ startAt: string; endAt: string } | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get the active reservation for the selected slot
  const activeReservation = reservations?.find(
    (r) => r.start_at === selectedSlot?.startAt && r.end_at === selectedSlot?.endAt
  );

  const handleSlotSelect = (startAt: string, endAt: string) => {
    setSelectedSlot({ startAt, endAt });
    setCurrentStep(1); // Move to confirmation step
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
      const sessionId = await createBooking.mutateAsync({
        session_type: 'DRAFTING',
        start_at: selectedSlot.startAt,
        end_at: selectedSlot.endAt,
        subject_id: selectedSubjectId,
        reservation_id: activeReservation?.id,
      });

      toast({
        title: 'Booking Confirmed',
        description: 'Your drafting session has been booked successfully',
      });

      router.push(`/sessions/${sessionId}`);
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

  const steps = [
    {
      id: 'subject',
      title: 'Select Subject',
      component: (
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
            <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
              <SelectTrigger>
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
          )}
        </div>
      ),
    },
    {
      id: 'time',
      title: 'Select Time',
      component: (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Choose an available time slot for your drafting session
          </p>
          {selectedSubjectId ? (
            <TimeSlotPicker
              sessionType="DRAFTING"
              subjectId={selectedSubjectId}
              durationMinutes={60}
              onSlotSelect={handleSlotSelect}
              selectedSlot={selectedSlot}
            />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Please select a subject first</p>
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'confirm',
      title: 'Confirm Booking',
      component: (
        <div className="space-y-4">
          {selectedSlot && selectedSubjectId ? (
            <>
              <div className="space-y-2">
                <h3 className="font-semibold">Booking Details</h3>
                <div className="space-y-1 text-sm">
                  <div>
                    <span className="font-medium">Subject:</span>{' '}
                    {(() => {
                      const subject = subjects?.find((s) => s.id === selectedSubjectId);
                      return subject ? formatSubjectDisplay(subject) : 'Unknown';
                    })()}
                  </div>
                  <div>
                    <span className="font-medium">Date & Time:</span>{' '}
                    {new Date(selectedSlot.startAt).toLocaleString('en-AU', {
                      dateStyle: 'long',
                      timeStyle: 'short',
                      timeZone: 'Australia/Adelaide',
                    })}
                  </div>
                  <div>
                    <span className="font-medium">Duration:</span> 60 minutes
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCurrentStep(1);
                    setSelectedSlot(null);
                  }}
                  disabled={isSubmitting}
                >
                  Back
                </Button>
                <Button onClick={handleConfirmBooking} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    'Confirm Booking'
                  )}
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Please complete the previous steps</p>
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="container max-w-4xl py-8">
      <BookingFlow
        title="Book Drafting Session"
        description="Schedule a one-on-one drafting session with a tutor"
        steps={steps}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
      />
    </div>
  );
}

