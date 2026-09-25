'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, useToast } from '@altitutor/ui';
import type { FormAnswerPayload, FormBlock } from '@altitutor/shared';
import { BookingFlow } from '@/features/bookings/components/BookingFlow';
import { TimeSlotPicker } from '@/features/bookings/components/TimeSlotPicker';
import { TrialContactForm, type TrialContactFormValues } from '@/features/bookings/components/TrialContactForm';
import { StudentExistsError } from '@/features/bookings/components/StudentExistsError';
import {
  SUBSIDY_APPLICATION_FORM_ID,
  SubsidyApplicationStep,
} from '@/features/bookings/components/SubsidyApplicationStep';
import { subsidyBookingStepIds, type SubsidyBookingStepId } from '@/features/bookings/lib/booking-steps';
import { useMinAdvanceBookingDays, useSessionDurationMinutes } from '@/features/bookings/hooks/useBookingSettings';
import { posthogIdentityHeaders } from '@/shared/lib/analytics/posthog';
import { formatSubjectDisplay, getSubjectColorStyle, cn } from '@/shared/utils';
import type { Tables } from '@altitutor/shared';
import type { UseFormReturn } from 'react-hook-form';

type SignedInStudent = {
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  curriculum: string | null;
  year_level: number | null;
};

type SubsidyFormPayload = {
  name: string;
  blocks: FormBlock[];
  thank_you_message: string;
};

function yearLabel(yearLevel: number | string | null | undefined) {
  if (yearLevel === 0 || yearLevel === 'Reception') return 'Reception';
  if (yearLevel === null || yearLevel === undefined || yearLevel === '') return null;
  return `Year ${yearLevel}`;
}

export default function BookSubsidyPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: defaultDurationMinutes = 45 } = useSessionDurationMinutes('SUBSIDY_INTERVIEW');
  const { data: minAdvanceDays = 1 } = useMinAdvanceBookingDays();

  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [student, setStudent] = useState<SignedInStudent | null>(null);
  const [subsidyForm, setSubsidyForm] = useState<SubsidyFormPayload | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<{ startAt: string; endAt: string; availableStaffIds?: string[] } | null>(null);
  const [contactData, setContactData] = useState<TrialContactFormValues | null>(null);
  const [contactFormRef, setContactFormRef] = useState<UseFormReturn<TrialContactFormValues> | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<Tables<'subjects'>[]>([]);
  const [subsidyAnswers, setSubsidyAnswers] = useState<FormAnswerPayload | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showStudentExistsError, setShowStudentExistsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/bookings/subsidy')
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load subsidy booking');
        return response.json() as Promise<{
          signed_in: boolean;
          student: SignedInStudent | null;
          form: SubsidyFormPayload | null;
        }>;
      })
      .then((data) => {
        if (cancelled) return;
        setSignedIn(data.signed_in);
        setStudent(data.student);
        setSubsidyForm(data.form);
      })
      .catch(() => {
        if (!cancelled) {
          toast({
            title: 'Could not load booking',
            description: 'Refresh the page and try again.',
            variant: 'destructive',
          });
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const stepIds = subsidyBookingStepIds({
    signedIn,
    hasSubsidyForm: Boolean(subsidyForm),
  });
  const stepId: SubsidyBookingStepId = stepIds[Math.min(currentStep, stepIds.length - 1)] ?? 'confirm';

  const durationMinutes = selectedSlot
    ? Math.round((new Date(selectedSlot.endAt).getTime() - new Date(selectedSlot.startAt).getTime()) / (1000 * 60))
    : defaultDurationMinutes;

  const handleConfirmBooking = async () => {
    if (!selectedSlot || (signedIn ? !student : !contactData)) {
      toast({ title: 'Missing information', description: 'Please complete all steps', variant: 'destructive' });
      return;
    }
    if (subsidyForm && !subsidyAnswers) {
      toast({ title: 'Application required', description: 'Complete the subsidy application before confirming.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(signedIn ? '/api/bookings/subsidy' : '/api/bookings/trial/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...posthogIdentityHeaders() },
        body: JSON.stringify(signedIn
          ? {
              start_at: selectedSlot.startAt,
              end_at: selectedSlot.endAt,
              form_answers: subsidyAnswers,
            }
          : {
              ...contactData,
              start_at: selectedSlot.startAt,
              end_at: selectedSlot.endAt,
              session_type: 'SUBSIDY_INTERVIEW',
              form_answers: subsidyAnswers,
            }),
      });
      const payload = await response.json();
      if (!response.ok) {
        if (payload.error === 'STUDENT_EXISTS') {
          setShowStudentExistsError(true);
          return;
        }
        throw new Error(payload.message || payload.error || 'Failed to create booking');
      }

      const bookingData = {
        session_id: payload.session_id,
        booking_token: payload.booking_token,
        session_type: 'SUBSIDY_INTERVIEW',
        start_at: selectedSlot.startAt,
        end_at: selectedSlot.endAt,
        student_first_name: signedIn ? student?.first_name : contactData?.student_first_name,
        student_last_name: signedIn ? student?.last_name : contactData?.student_last_name,
        student_email: signedIn ? student?.email : contactData?.student_email,
        student_phone: signedIn ? student?.phone : contactData?.student_phone,
        curriculum: signedIn ? student?.curriculum : contactData?.curriculum,
        year_level: signedIn ? student?.year_level : contactData?.year_level,
        subject_ids: contactData?.subject_ids,
        subjects: selectedSubjects.length > 0 ? selectedSubjects : undefined,
      };
      sessionStorage.setItem('trial_booking_data', JSON.stringify(bookingData));
      toast({ title: 'Interview booked', description: 'Your subsidy interview has been booked.' });
      router.push(payload.booking_token ? `/b/${payload.booking_token}` : `/booking-success?sessionId=${payload.session_id}`);
    } catch (error: unknown) {
      toast({
        title: 'Booking failed',
        description: error instanceof Error ? error.message : 'Failed to create booking. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const advance = () => setCurrentStep((step) => Math.min(step + 1, stepIds.length - 1));

  const handleNext = () => {
    if (stepId === 'identity') return;
    if (stepId === 'time') {
      if (!selectedSlot) {
        toast({ title: 'Please select a time', description: 'You must select a time slot before continuing', variant: 'destructive' });
        return;
      }
      advance();
      return;
    }
    if (stepId === 'contact') {
      if (!contactFormRef) return;
      void contactFormRef.trigger().then((isValid) => {
        if (!isValid) {
          toast({ title: 'Check your details', description: 'Some required details are missing.', variant: 'destructive' });
          return;
        }
        void contactFormRef.handleSubmit((data) => {
          setContactData(data);
          advance();
        })();
      });
      return;
    }
    if (stepId === 'application') {
      const form = document.getElementById(SUBSIDY_APPLICATION_FORM_ID);
      if (form instanceof HTMLFormElement) form.requestSubmit();
    }
  };

  const studentName = signedIn
    ? `${student?.first_name ?? ''} ${student?.last_name ?? ''}`.trim()
    : `${contactData?.student_first_name ?? ''} ${contactData?.student_last_name ?? ''}`.trim();
  const studentEmail = signedIn ? student?.email : contactData?.student_email;
  const studentPhone = signedIn ? student?.phone : contactData?.student_phone;
  const curriculum = signedIn ? student?.curriculum : contactData?.curriculum;
  const yearLevel = signedIn ? student?.year_level : contactData?.year_level;

  const steps = stepIds.map((id) => {
    if (id === 'identity') {
      return {
        id,
        title: 'Start',
        component: (
          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              className="rounded-lg border p-6 text-left hover:border-primary"
              onClick={() => router.push('/login?next=/booking/subsidy')}
            >
              <h2 className="text-lg font-semibold">I am already an Altitutor student</h2>
              <p className="mt-2 text-sm text-muted-foreground">Sign in, then book the interview for your account.</p>
            </button>
            <button
              type="button"
              className="rounded-lg border p-6 text-left hover:border-primary"
              onClick={() => setCurrentStep(1)}
            >
              <h2 className="text-lg font-semibold">I am not an Altitutor student</h2>
              <p className="mt-2 text-sm text-muted-foreground">Continue as a new student and book a subsidy interview.</p>
            </button>
          </div>
        ),
      };
    }
    if (id === 'time') {
      return {
        id,
        title: 'Select time',
        component: (
          <TimeSlotPicker
            sessionType="SUBSIDY_INTERVIEW"
            durationMinutes={defaultDurationMinutes}
            minAdvanceDays={minAdvanceDays}
            onSlotSelect={(startAt, endAt, availableStaffIds) => setSelectedSlot({ startAt, endAt, availableStaffIds })}
            selectedSlot={selectedSlot}
            allowAnonymous
          />
        ),
      };
    }
    if (id === 'contact') {
      return {
        id,
        title: 'Details',
        component: (
          <TrialContactForm
            onSubmit={(data) => {
              setContactData(data);
              advance();
            }}
            defaultValues={contactData || undefined}
            onFormReady={setContactFormRef}
            onSelectedSubjectsChange={setSelectedSubjects}
          />
        ),
      };
    }
    if (id === 'application' && subsidyForm) {
      return {
        id,
        title: 'Subsidy application',
        component: (
          <SubsidyApplicationStep
            name={subsidyForm.name}
            blocks={subsidyForm.blocks}
            initialAnswers={subsidyAnswers}
            onComplete={(answers) => {
              setSubsidyAnswers(answers);
              advance();
            }}
          />
        ),
      };
    }
    return {
      id: 'confirm',
      title: 'Confirm booking',
      component: showStudentExistsError ? (
        <StudentExistsError loginHref="/login?next=/booking/subsidy" />
      ) : (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Booking details</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div className="text-sm font-medium text-muted-foreground">Student:</div>
            <div className="text-sm">{studentName}</div>
            {studentEmail && (
              <>
                <div className="text-sm font-medium text-muted-foreground">Email:</div>
                <div className="text-sm">{studentEmail}</div>
              </>
            )}
            {studentPhone && (
              <>
                <div className="text-sm font-medium text-muted-foreground">Phone:</div>
                <div className="text-sm">{studentPhone}</div>
              </>
            )}
            {curriculum && (
              <>
                <div className="text-sm font-medium text-muted-foreground">Curriculum:</div>
                <div className="text-sm">
                  {curriculum}
                  {yearLabel(yearLevel) ? ` - ${yearLabel(yearLevel)}` : ''}
                </div>
              </>
            )}
            {selectedSubjects.length > 0 && (
              <>
                <div className="text-sm font-medium text-muted-foreground">Subjects:</div>
                <div className="flex flex-wrap gap-2">
                  {selectedSubjects.map((subject) => {
                    const { style, textColorClass } = getSubjectColorStyle(subject);
                    return (
                      <Badge key={subject.id} className={cn(textColorClass, 'border-0')} style={style.backgroundColor ? style : undefined}>
                        {formatSubjectDisplay(subject)}
                      </Badge>
                    );
                  })}
                </div>
              </>
            )}
            {selectedSlot && (
              <>
                <div className="text-sm font-medium text-muted-foreground">When:</div>
                <div className="text-sm">
                  {new Date(selectedSlot.startAt).toLocaleString('en-AU', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZone: 'Australia/Adelaide',
                  })}
                  {' '}({durationMinutes} minutes)
                </div>
              </>
            )}
          </div>
        </div>
      ),
    };
  });

  if (!ready) {
    return <div className="container max-w-4xl py-8 text-sm text-muted-foreground">Loading booking…</div>;
  }

  return (
    <div className="container max-w-4xl py-8">
      <BookingFlow
        title="Book a subsidy interview"
        description="Tell us about your situation and choose a time to meet."
        steps={steps}
        currentStep={Math.min(currentStep, steps.length - 1)}
        onNext={handleNext}
        onBack={() => setCurrentStep((step) => Math.max(0, step - 1))}
        onConfirm={stepId === 'confirm' ? handleConfirmBooking : undefined}
        isSubmitting={isSubmitting}
        canProceed={stepId === 'time' ? !!selectedSlot : true}
        selectedSlot={selectedSlot}
        showSlotSummary={stepId === 'contact'}
      />
    </div>
  );
}
