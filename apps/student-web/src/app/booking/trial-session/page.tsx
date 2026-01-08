'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BookingFlow } from '@/features/bookings/components/BookingFlow';
import { TimeSlotPicker } from '@/features/bookings/components/TimeSlotPicker';
import { TrialContactForm } from '@/features/bookings/components/TrialContactForm';
import { StudentExistsError } from '@/features/bookings/components/StudentExistsError';
import { useToast } from '@altitutor/ui';
import type { TrialContactFormValues } from '@/features/bookings/components/TrialContactForm';
import type { UseFormReturn } from 'react-hook-form';
import type { Tables } from '@altitutor/shared';
import { formatSubjectDisplay, getSubjectColorStyle } from '@/shared/utils';
import { Badge } from '@altitutor/ui';
import { cn } from '@/shared/utils';
import { useSessionDurationMinutes } from '@/features/bookings/hooks/useBookingSettings';

export default function BookTrialPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { data: durationMinutes = 60 } = useSessionDurationMinutes('TRIAL_SESSION');
  
  // Initialize state from query params
  const [contactData, setContactData] = useState<TrialContactFormValues | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ startAt: string; endAt: string; availableStaffIds?: string[] } | null>(null);
  const [currentStep, setCurrentStep] = useState(() => {
    const stepParam = searchParams.get('step');
    return stepParam ? parseInt(stepParam, 10) : 0;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showStudentExistsError, setShowStudentExistsError] = useState(false);
  const [contactFormRef, setContactFormRef] = useState<UseFormReturn<TrialContactFormValues> | null>(null);
  const [_isFormValid, setIsFormValid] = useState(false);
  const [selectedSubjects, setSelectedSubjects] = useState<Tables<'subjects'>[]>([]);

  // Initialize selectedSlot from query params on mount
  useEffect(() => {
    const timeParam = searchParams.get('time');
    if (timeParam) {
      const [startAt, endAt] = timeParam.split('/');
      if (startAt && endAt && !selectedSlot) {
        setSelectedSlot({ startAt, endAt, availableStaffIds: [] });
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
      router.replace(`/booking/trial-session?${params.toString()}`, { scroll: false });
    }
  }, [currentStep, selectedSlot, router]);

  const handleSlotSelect = (startAt: string, endAt: string, availableStaffIds: string[]) => {
    setSelectedSlot({ startAt, endAt, availableStaffIds });
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

      // Store booking data in sessionStorage for the success page
      const bookingData = {
        session_id,
        start_at: selectedSlot.startAt,
        end_at: selectedSlot.endAt,
        student_first_name: contactData.student_first_name,
        student_last_name: contactData.student_last_name,
        student_email: contactData.student_email,
        student_phone: contactData.student_phone,
        curriculum: contactData.curriculum,
        year_level: contactData.year_level,
        subject_ids: contactData.subject_ids,
        subjects: selectedSubjects.length > 0 ? selectedSubjects : undefined,
      };
      
      sessionStorage.setItem('trial_booking_data', JSON.stringify(bookingData));

      // Redirect to success page
      router.push(`/booking-success?sessionId=${session_id}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create booking. Please try again.';
      toast({
        title: 'Booking Failed',
        description: errorMessage,
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
          <TimeSlotPicker
            sessionType="TRIAL_SESSION"
            durationMinutes={durationMinutes}
            onSlotSelect={handleSlotSelect}
            selectedSlot={selectedSlot}
            allowAnonymous={true}
          />
        </div>
      ),
    },
    {
      id: 'contact',
      title: 'Details',
      component: (
        <TrialContactForm
          onSubmit={handleContactSubmit}
          defaultValues={contactData || undefined}
          onFormReady={setContactFormRef}
          onValidityChange={setIsFormValid}
          onSelectedSubjectsChange={setSelectedSubjects}
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
              <div>
                <h3 className="text-lg font-semibold mb-4">Booking Details</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div className="text-sm font-medium text-muted-foreground">Student:</div>
                  <div className="text-sm">
                    {contactData.student_first_name} {contactData.student_last_name}
                  </div>
                  
                  <div className="text-sm font-medium text-muted-foreground">Email:</div>
                  <div className="text-sm">{contactData.student_email}</div>
                  
                  <div className="text-sm font-medium text-muted-foreground">Phone:</div>
                  <div className="text-sm">{contactData.student_phone}</div>
                  
                  <div className="text-sm font-medium text-muted-foreground">Curriculum:</div>
                  <div className="text-sm">
                    {contactData.curriculum}
                    {contactData.year_level && ` - Year ${contactData.year_level === 'Reception' ? 'Reception' : contactData.year_level}`}
                  </div>
                  
                  {contactData.subject_ids && contactData.subject_ids.length > 0 && (
                    <>
                      <div className="text-sm font-medium text-muted-foreground">Subjects:</div>
                      <div className="text-sm">
                        {selectedSubjects.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {selectedSubjects.map((subject) => {
                              const { style, textColorClass } = getSubjectColorStyle(subject);
                              const defaultClass = !subject.color ? 'bg-gray-100 text-gray-800' : '';
                              return (
                                <Badge
                                  key={subject.id}
                                  className={cn(
                                    defaultClass || `${textColorClass} border-0`,
                                    !defaultClass && 'border-0'
                                  )}
                                  style={style.backgroundColor ? style : undefined}
                                >
                                  {formatSubjectDisplay(subject)}
                                </Badge>
                              );
                            })}
                          </div>
                        ) : (
                          `${contactData.subject_ids.length} subject${contactData.subject_ids.length !== 1 ? 's' : ''} selected`
                        )}
                      </div>
                    </>
                  )}
                  
                  <div className="text-sm font-medium text-muted-foreground">Date:</div>
                  <div className="text-sm">
                    {new Date(selectedSlot.startAt).toLocaleDateString('en-AU', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      timeZone: 'Australia/Adelaide',
                    })}
                  </div>
                  
                  <div className="text-sm font-medium text-muted-foreground">Time:</div>
                  <div className="text-sm">
                    {new Date(selectedSlot.startAt).toLocaleTimeString('en-AU', {
                      hour: 'numeric',
                      minute: '2-digit',
                      timeZone: 'Australia/Adelaide',
                    })} - {new Date(selectedSlot.endAt).toLocaleTimeString('en-AU', {
                      hour: 'numeric',
                      minute: '2-digit',
                      timeZone: 'Australia/Adelaide',
                    })}
                  </div>
                  
                  <div className="text-sm font-medium text-muted-foreground">Duration:</div>
                  <div className="text-sm">
                    {durationMinutes} minutes
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
      // Trigger form submission programmatically - this will show field-level errors
      if (contactFormRef) {
        // Trigger validation on all fields to show errors
        contactFormRef.trigger().then((isValid) => {
          if (isValid) {
            // Form is valid, proceed with submission
            contactFormRef.handleSubmit(handleContactSubmit)();
          } else {
            // Form is invalid - errors will be shown on individual fields via FormMessage
            // Also show a toast with summary
            const errors = contactFormRef.formState.errors;
            const errorMessages: string[] = [];
            
            if (errors.student_first_name) {
              errorMessages.push('Student first name is required');
            }
            if (errors.student_last_name) {
              errorMessages.push('Student last name is required');
            }
            if (errors.student_email) {
              errorMessages.push(`Student email: ${errors.student_email.message || 'is invalid'}`);
            }
            if (errors.student_phone) {
              errorMessages.push('Student phone number is required');
            }
            if (errors.curriculum) {
              errorMessages.push('Please select a curriculum');
            }
            if (errors.year_level) {
              errorMessages.push('Please select a year level');
            }
            if (errors.subject_ids) {
              errorMessages.push(`Subjects: ${errors.subject_ids.message || 'Please select at least one subject'}`);
            }
            // Check parent fields if not skipping
            const skipParentDetails = contactFormRef.getValues('skip_parent_details');
            if (!skipParentDetails) {
              if (errors.parent_first_name) {
                errorMessages.push('Parent first name is required');
              }
              if (errors.parent_last_name) {
                errorMessages.push('Parent last name is required');
              }
              if (errors.parent_email) {
                errorMessages.push(`Parent email: ${errors.parent_email.message || 'is invalid'}`);
              }
              if (errors.parent_phone) {
                errorMessages.push('Parent phone number is required');
              }
            }
            
            if (errorMessages.length > 0) {
              toast({
                title: 'Please fix the following errors',
                description: errorMessages.join(', '),
                variant: 'destructive',
              });
            }
          }
        });
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
        steps={steps}
        currentStep={currentStep}
        onStepChange={handleStepChange}
        onNext={handleNext}
        onBack={handleBack}
        onConfirm={currentStep === 2 ? handleConfirmBooking : undefined}
        isSubmitting={isSubmitting}
        canProceed={currentStep === 0 ? !!selectedSlot : true}
        selectedSlot={selectedSlot}
      />
    </div>
  );
}
