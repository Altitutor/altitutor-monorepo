'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@altitutor/ui';
import { Card, CardContent } from '@altitutor/ui';
import { Form } from '@altitutor/ui';
import { Loader2 } from 'lucide-react';
import { cn } from '@/shared/utils';
import { useToast } from '@altitutor/ui';
import { useSupabaseClient } from '@/shared/lib/supabase/client';
import { RegistrationStep1StudentDetails } from './RegistrationStep1StudentDetails';
import { RegistrationStep2ParentDetails } from './RegistrationStep2ParentDetails';
import { RegistrationStep3Availability } from './RegistrationStep3Availability';
import { RegistrationStep4Password } from './RegistrationStep4Password';
import { RegistrationStep5Confirm } from './RegistrationStep5Confirm';

// Registration form schema
const registrationSchema = z.object({
  // Student details
  student: z.object({
    first_name: z.string().min(1, 'First name is required'),
    last_name: z.string().min(1, 'Last name is required'),
    email: z.string().email('Invalid email address'),
    phone: z.string().min(1, 'Phone number is required'),
    school: z.string().optional(),
    curriculum: z.enum(['SACE', 'IB', 'PRESACE', 'PRIMARY']).optional(),
    year_level: z.coerce.number().int().min(0).max(13).optional(),
    subject_ids: z.array(z.string().uuid()),
  }),
  // Parents
  parents: z.array(z.object({
    id: z.string().optional(),
    first_name: z.string().min(1, 'First name is required'),
    last_name: z.string().min(1, 'Last name is required'),
    email: z.string().email('Invalid email address'),
    phone: z.string().min(1, 'Phone number is required'),
  })).min(1, 'At least one parent is required'),
  // Availability
  availability: z.object({
    monday: z.boolean(),
    tuesday: z.boolean(),
    wednesday: z.boolean(),
    thursday: z.boolean(),
    friday: z.boolean(),
    saturday_am: z.boolean(),
    saturday_pm: z.boolean(),
    sunday_am: z.boolean(),
    sunday_pm: z.boolean(),
  }).refine(
    (data) => Object.values(data).some((val) => val === true),
    { message: 'At least one availability day must be selected' }
  ),
  // Password
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
}).refine(
  (data) => data.parents.some((p) => p.email && p.email.trim() !== '' && p.phone && p.phone.trim() !== ''),
  { message: 'At least one parent must have both email and phone', path: ['parents'] }
);

type RegistrationFormValues = z.infer<typeof registrationSchema>;

interface RegistrationFlowProps {
  token: string;
  initialData: {
    student: {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      phone: string;
      school: string;
      curriculum: string;
      year_level: number | null;
    };
    parents: Array<{
      id?: string;
      first_name: string;
      last_name: string;
      email: string;
      phone: string;
    }>;
    subjects: Array<{
      id: string;
      name: string;
      year_level: number | null;
      curriculum: string | null;
      color: string | null;
    }>;
  };
  currentStep: number;
  onStepChange: (step: number) => void;
  skipPassword?: boolean; // Skip password step if student already has an account
}

const STEPS = [
  { id: 'student', title: 'Student Details' },
  { id: 'parents', title: 'Parent Details' },
  { id: 'availability', title: 'Availability' },
  { id: 'password', title: 'Password' },
  { id: 'confirm', title: 'Confirm' },
];

export function RegistrationFlow({
  token,
  initialData,
  currentStep,
  onStepChange,
  skipPassword = false,
}: RegistrationFlowProps) {
  // Adjust steps based on skipPassword flag
  const steps = skipPassword 
    ? STEPS.filter(step => step.id !== 'password')
    : STEPS;
  const router = useRouter();
  const { toast } = useToast();
  const supabase = useSupabaseClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationSchema),
    mode: 'onChange',
    defaultValues: {
      student: {
        first_name: initialData.student.first_name,
        last_name: initialData.student.last_name,
        email: initialData.student.email,
        phone: initialData.student.phone,
        school: initialData.student.school || undefined,
        curriculum: (initialData.student.curriculum as 'SACE' | 'IB' | 'PRESACE' | 'PRIMARY') || undefined,
        year_level: initialData.student.year_level || undefined,
        subject_ids: initialData.subjects.map((s) => s.id),
      },
      parents: initialData.parents.length > 0
        ? initialData.parents.map((p) => ({
            id: p.id,
            first_name: p.first_name,
            last_name: p.last_name,
            email: p.email,
            phone: p.phone,
          }))
        : [{ first_name: '', last_name: '', email: '', phone: '' }],
      availability: {
        monday: false,
        tuesday: false,
        wednesday: false,
        thursday: false,
        friday: false,
        saturday_am: false,
        saturday_pm: false,
        sunday_am: false,
        sunday_pm: false,
      },
      password: '',
      confirmPassword: '',
    },
  });

  const handleNext = async () => {
    // Validate current step before proceeding
    const fieldsToValidate: (keyof RegistrationFormValues)[] = [];
    
    // Map current step to actual step index (accounting for skipped password step)
    const actualStep = skipPassword && currentStep >= 3 ? currentStep + 1 : currentStep;
    
    if (actualStep === 0) {
      fieldsToValidate.push('student');
    } else if (actualStep === 1) {
      fieldsToValidate.push('parents');
    } else if (actualStep === 2) {
      fieldsToValidate.push('availability');
    } else if (actualStep === 3 && !skipPassword) {
      fieldsToValidate.push('password', 'confirmPassword');
    }

    const isValid = await form.trigger(fieldsToValidate as any);
    
    if (isValid) {
      onStepChange(currentStep + 1);
    } else {
      toast({
        title: 'Please fix the errors',
        description: 'Some fields are invalid. Please check and try again.',
        variant: 'destructive',
      });
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      onStepChange(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    // Prevent multiple submissions
    if (isSubmitting) {
      return;
    }

    const isValid = await form.trigger();
    if (!isValid) {
      toast({
        title: 'Please fix the errors',
        description: 'Some fields are invalid. Please check and try again.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = form.getValues();
      
      const response = await fetch('/api/register/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          student: {
            ...formData.student,
            availability_monday: formData.availability.monday,
            availability_tuesday: formData.availability.tuesday,
            availability_wednesday: formData.availability.wednesday,
            availability_thursday: formData.availability.thursday,
            availability_friday: formData.availability.friday,
            availability_saturday_am: formData.availability.saturday_am,
            availability_saturday_pm: formData.availability.saturday_pm,
            availability_sunday_am: formData.availability.sunday_am,
            availability_sunday_pm: formData.availability.sunday_pm,
          },
          parents: formData.parents,
          subject_ids: formData.student.subject_ids,
          password: skipPassword ? undefined : formData.password,
          confirmPassword: skipPassword ? undefined : formData.confirmPassword,
          skipPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.alreadyRegistered) {
          toast({
            title: 'Already Registered',
            description: 'You already have an account. Redirecting to login...',
            variant: 'default',
          });
          router.push('/login');
          return;
        }
        throw new Error(data.error || 'Registration failed');
      }

      toast({
        title: 'Registration Successful!',
        description: skipPassword ? 'Redirecting to dashboard...' : 'Signing you in...',
      });

      // If skipping password, student already has an account - redirect to dashboard
      if (skipPassword) {
        const redirectUrl = data.redirectTo || '/dashboard';
        window.location.replace(redirectUrl);
        return;
      }

      // Sign in the user with the credentials they just created
      try {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.student.email,
          password: formData.password!,
        });

        if (signInError) {
          console.error('Sign in error:', signInError);
          // Account created but auto-login failed, redirect to login
          toast({
            title: 'Account Created',
            description: 'Your account was created successfully. Please sign in.',
            variant: 'default',
          });
          router.push('/login?registered=success');
          return;
        }

        // Verify session is established before redirecting
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.warn('Session not established after sign-in, redirecting to login');
          toast({
            title: 'Account Created',
            description: 'Your account was created successfully. Please sign in.',
            variant: 'default',
          });
          router.push('/login?registered=success');
          return;
        }

        // Use full page redirect to ensure cookies are properly set
        // This ensures a complete page reload and proper session establishment
        const redirectUrl = data.redirectTo || '/dashboard';
        
        // Force a hard redirect - this ensures the page fully reloads
        // and the middleware can properly check authentication
        window.location.replace(redirectUrl);
      } catch (signInErr) {
        console.error('Auto-login error:', signInErr);
        // Redirect to login page
        toast({
          title: 'Account Created',
          description: 'Your account was created successfully. Please sign in.',
          variant: 'default',
        });
        router.push('/login?registered=success');
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast({
        title: 'Registration Failed',
        description: error instanceof Error ? error.message : 'An error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  return (
    <div className="container max-w-4xl py-8">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Complete Your Registration</h1>
          <p className="text-muted-foreground mt-2">
            Please complete the following steps to create your account
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center space-x-2">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium',
                  index === currentStep
                    ? 'bg-primary text-primary-foreground'
                    : index < currentStep
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
                    index < currentStep ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Current Step Content */}
        <Card>
          <CardContent className="pt-6">
            <Form {...form}>
              <div className="space-y-6">
                {currentStep === 0 && (
                  <RegistrationStep1StudentDetails
                    form={form}
                    initialSubjects={initialData.subjects}
                  />
                )}
                {currentStep === 1 && (
                  <RegistrationStep2ParentDetails form={form} />
                )}
                {currentStep === 2 && (
                  <RegistrationStep3Availability form={form} />
                )}
                {!skipPassword && currentStep === 3 && (
                  <RegistrationStep4Password form={form} />
                )}
                {(skipPassword ? currentStep === 3 : currentStep === 4) && (
                  <RegistrationStep5Confirm form={form} />
                )}

                {/* Navigation Buttons */}
                <div className="flex gap-2 pt-4 border-t">
                  {!isFirstStep && (
                    <Button
                      variant="outline"
                      onClick={handleBack}
                      disabled={isSubmitting}
                    >
                      Back
                    </Button>
                  )}
                  <div className="flex-1" />
                  {!isLastStep ? (
                    <Button
                      onClick={handleNext}
                      disabled={isSubmitting}
                    >
                      Next
                    </Button>
                  ) : (
                    <Button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Completing Registration...
                        </>
                      ) : (
                        'Complete Registration'
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
