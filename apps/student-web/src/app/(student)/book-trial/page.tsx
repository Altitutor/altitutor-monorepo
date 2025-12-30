'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookingFlow } from '@/features/bookings/components/BookingFlow';
import { TimeSlotPicker } from '@/features/bookings/components/TimeSlotPicker';
import { useCreateBooking } from '@/features/bookings/hooks/useCreateBooking';
import { useMyReservations } from '@/features/bookings/hooks/useReservations';
import { Button, useToast } from '@altitutor/ui';
import { Loader2 } from 'lucide-react';

export default function BookTrialPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: reservations } = useMyReservations();
  const createBooking = useCreateBooking();

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
    if (!selectedSlot) {
      toast({
        title: 'Missing Information',
        description: 'Please select a time slot',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const sessionId = await createBooking.mutateAsync({
        session_type: 'TRIAL_SESSION',
        start_at: selectedSlot.startAt,
        end_at: selectedSlot.endAt,
        // subject_id is optional for trial sessions
        reservation_id: activeReservation?.id,
      });

      toast({
        title: 'Booking Confirmed',
        description: 'Your trial session has been booked successfully',
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

  const steps = [
    {
      id: 'time',
      title: 'Select Time',
      component: (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Choose an available time slot for your trial session
          </p>
          <TimeSlotPicker
            sessionType="TRIAL_SESSION"
            durationMinutes={60}
            onSlotSelect={handleSlotSelect}
            selectedSlot={selectedSlot}
          />
        </div>
      ),
    },
    {
      id: 'confirm',
      title: 'Confirm Booking',
      component: (
        <div className="space-y-4">
          {selectedSlot ? (
            <>
              <div className="space-y-2">
                <h3 className="font-semibold">Booking Details</h3>
                <div className="space-y-1 text-sm">
                  <div>
                    <span className="font-medium">Session Type:</span> Trial Session
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
                    setCurrentStep(0);
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
        title="Book Trial Session"
        description="Schedule a free trial session to experience our tutoring"
        steps={steps}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
      />
    </div>
  );
}

