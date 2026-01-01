'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BookingFlow } from '@/features/bookings/components/BookingFlow';
import { TimeSlotPicker } from '@/features/bookings/components/TimeSlotPicker';
import { TrialContactForm } from '@/features/bookings/components/TrialContactForm';
import { StudentExistsError } from '@/features/bookings/components/StudentExistsError';
import { Button, useToast } from '@altitutor/ui';
import { Loader2 } from 'lucide-react';
import type { TrialContactFormValues } from '@/features/bookings/components/TrialContactForm';

export default function BookTrialPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  // Initialize state from query params
  const [contactData, setContactData] = useState<TrialContactFormValues | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ startAt: string; endAt: string } | null>(null);
  const [currentStep, setCurrentStep] = useState(() => {
    const stepParam = searchParams.get('step');
    return stepParam ? parseInt(stepParam, 10) : 0;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showStudentExistsError, setShowStudentExistsError] = useState(false);
  const [contactFormRef, setContactFormRef] = useState<any>(null);

  // Initialize selectedSlot from query params on mount
  useEffect(() => {
    const timeParam = searchParams.get('time');
    if (timeParam) {
      const [startAt, endAt] = timeParam.split('/');
      if (startAt && endAt && !selectedSlot) {
        setSelectedSlot({ startAt, endAt });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Sync query params with state (but don't overwrite on initial mount)
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('step', currentStep.toString());
    
    if (selectedSlot) {
      const startDate = new Date(selectedSlot.startAt);
      params.set('date', startDate.toISOString().split('T')[0]);
      params.set('time', `${selectedSlot.startAt}/${selectedSlot.endAt}`);
    }
    
    // Only update if params actually changed to avoid infinite loops
    const currentParams = new URLSearchParams(window.location.search);
    const stepChanged = currentParams.get('step') !== currentStep.toString();
    const timeChanged = currentParams.get('time') !== (selectedSlot ? `${selectedSlot.startAt}/${selectedSlot.endAt}` : null);
    
    if (stepChanged || timeChanged) {
      router.replace(`/book-trial?${params.toString()}`, { scroll: false });
    }
  }, [currentStep, selectedSlot, router]);

  const handleSlotSelect = (startAt: string, endAt: string) => {
    setSelectedSlot({ startAt, endAt });
    // Don't auto-proceed - user clicks Next button
  };

  const handleContactSubmit = (data: TrialContactFormValues) => {
    setContactData(data);
    setCurrentStep(2); // Move to confirmation (step 0 = time, step 1 = contact, step 2 = confirm)
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
        
        // Handle student exists error (email conflict)
        if (error.error === 'STUDENT_EXISTS') {
          setShowStudentExistsError(true);
          return;
        }
        
        // Handle phone conflict error
        if (error.error === 'PHONE_CONFLICT') {
          toast({
            title: 'Phone Number Already in Use',
            description: error.message || 'This phone number is already associated with another account. Please use a different phone number.',
            variant: 'destructive',
          });
          return;
        }
        
        // Handle other 409 conflicts
        if (response.status === 409) {
          toast({
            title: 'Conflict',
            description: error.message || 'This information is already associated with another account.',
            variant: 'destructive',
          });
          return;
        }
        
        throw new Error(error.error || error.message || 'Failed to create booking');
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
      id: 'contact',
      title: 'Student Details',
      component: (
        <TrialContactForm
          onSubmit={handleContactSubmit}
          defaultValues={contactData || undefined}
          onFormReady={setContactFormRef}
        />
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
                    {contactData.year_level && ` - Year ${contactData.year_level === 'Reception' ? 'Reception' : contactData.year_level}`}
                  </div>
                  {contactData.subject_ids && contactData.subject_ids.length > 0 && (
                    <div>
                      <span className="font-medium">Subjects:</span>{' '}
                      <span className="text-sm text-muted-foreground">
                        {contactData.subject_ids.length} subject{contactData.subject_ids.length !== 1 ? 's' : ''} selected
                      </span>
                    </div>
                  )}
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
              {/* Back/Next buttons are handled by BookingFlow component */}
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

  const handleStepChange = (step: number) => {
    setCurrentStep(step);
  };

  const handleNext = () => {
    if (currentStep === 0) {
      // From time selection to contact form
      if (!selectedSlot) {
        toast({
          title: 'Please select a time',
          description: 'You must select a time slot before continuing',
          variant: 'destructive',
        });
        return;
      }
      setCurrentStep(1);
    } else if (currentStep === 1) {
      // From contact form to confirmation
      // Trigger form submission programmatically
      if (contactFormRef) {
        contactFormRef.handleSubmit(
          handleContactSubmit,
          (errors) => {
            // Show validation errors
            const firstError = Object.values(errors)[0];
            if (firstError) {
              toast({
                title: 'Please complete all required fields',
                description: 'Some required fields are missing or invalid',
                variant: 'destructive',
              });
            }
          }
        )();
      } else {
        toast({
          title: 'Form not ready',
          description: 'Please wait for the form to load',
          variant: 'destructive',
        });
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="container max-w-4xl py-8">
      <BookingFlow
        title="Book Trial Session"
        description="Schedule a free trial session to experience our tutoring"
        steps={steps}
        currentStep={currentStep}
        onStepChange={handleStepChange}
        onNext={handleNext}
        onBack={handleBack}
        onConfirm={currentStep === 2 ? handleConfirmBooking : undefined}
        isSubmitting={isSubmitting}
        canProceed={currentStep === 0 ? !!selectedSlot : currentStep === 1 ? !!contactData : true}
        selectedSlot={selectedSlot}
      />
    </div>
  );
}
