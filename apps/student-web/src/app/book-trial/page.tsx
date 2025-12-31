'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookingFlow } from '@/features/bookings/components/BookingFlow';
import { TimeSlotPicker } from '@/features/bookings/components/TimeSlotPicker';
import { TrialContactForm } from '@/features/bookings/components/TrialContactForm';
import { StudentExistsError } from '@/features/bookings/components/StudentExistsError';
import { Button, useToast } from '@altitutor/ui';
import { Loader2 } from 'lucide-react';
import type { TrialContactFormValues } from '@/features/bookings/components/TrialContactForm';

export default function BookTrialPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [contactData, setContactData] = useState<TrialContactFormValues | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ startAt: string; endAt: string } | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showStudentExistsError, setShowStudentExistsError] = useState(false);

  const handleContactSubmit = (data: TrialContactFormValues) => {
    setContactData(data);
    setCurrentStep(1); // Move to time selection
  };

  const handleSlotSelect = (startAt: string, endAt: string) => {
    setSelectedSlot({ startAt, endAt });
    setCurrentStep(2); // Move to confirmation
  };

  const handleConfirmBooking = async () => {
    if (!selectedSlot || !contactData) {
      toast({
        title: 'Missing Information',
        description: 'Please complete all steps',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/bookings/trial/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...contactData,
          start_at: selectedSlot.startAt,
          end_at: selectedSlot.endAt,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        
        // Handle student exists error
        if (error.error === 'STUDENT_EXISTS' || response.status === 409) {
          setShowStudentExistsError(true);
          return;
        }
        
        throw new Error(error.error || 'Failed to create booking');
      }

      const { session_id } = await response.json();

      toast({
        title: 'Booking Confirmed',
        description: 'Your trial session has been booked successfully',
      });

      // Redirect to success page (we'll create a simple success message for now)
      // For now, redirect to home with success message
      router.push(`/?bookingSuccess=true&sessionId=${session_id}`);
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
      id: 'contact',
      title: 'Student Details',
      component: (
        <TrialContactForm
          onSubmit={handleContactSubmit}
          defaultValues={contactData || undefined}
        />
      ),
    },
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
            allowAnonymous={true}
          />
        </div>
      ),
    },
    {
      id: 'confirm',
      title: 'Confirm Booking',
      component: (
        <div className="space-y-4">
          {showStudentExistsError ? (
            <StudentExistsError />
          ) : selectedSlot && contactData ? (
            <>
              <div className="space-y-2">
                <h3 className="font-semibold">Booking Details</h3>
                <div className="space-y-1 text-sm">
                  <div>
                    <span className="font-medium">Student:</span>{' '}
                    {contactData.student_first_name} {contactData.student_last_name}
                  </div>
                  <div>
                    <span className="font-medium">Email:</span> {contactData.student_email}
                  </div>
                  <div>
                    <span className="font-medium">Curriculum:</span> {contactData.curriculum}
                    {contactData.year_level && ` - Year ${contactData.year_level}`}
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
        title="Book Trial Session"
        description="Schedule a free trial session to experience our tutoring"
        steps={steps}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
      />
    </div>
  );
}
