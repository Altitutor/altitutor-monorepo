'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registrationSchema, type RegistrationFormValues } from '../validations';
import { Button } from '@altitutor/ui';
import { Form } from '@altitutor/ui';
import { Loader2 } from 'lucide-react';
import { cn } from '@/shared/utils';
import { useToast } from '@altitutor/ui';
import { useSupabaseClient } from '@/shared/lib/supabase/client';
import { RegistrationStep1StudentDetails } from './RegistrationStep1StudentDetails';
import { RegistrationStep2ParentDetails } from './RegistrationStep2ParentDetails';
import { RegistrationStep3Availability } from './RegistrationStep3Availability';
import { RegistrationStep4Password } from './RegistrationStep4Password';
import { RegistrationStep4PaymentMethod } from './RegistrationStep4PaymentMethod';
import { RegistrationStep5Confirm } from './RegistrationStep5Confirm';

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
      short_name?: string | null;
      long_name?: string | null;
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
  { id: 'payment', title: 'Payment Method' },
  { id: 'confirm', title: 'Confirm' },
];

export function RegistrationFlow({
  token,
  initialData,
  currentStep,
  onStepChange,
  skipPassword = false,
}: RegistrationFlowProps) {
  // Always show all steps (including password step)
  // When skipPassword is true, the password step will show "Enter your password" instead of "Create password"
  const steps = STEPS;
  const router = useRouter();
  const { toast } = useToast();
  const supabase = useSupabaseClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [preloadedClientSecret, setPreloadedClientSecret] = useState<string | null>(null);
  const [isPreloadingPayment, setIsPreloadingPayment] = useState(false);
  const isRedirectingRef = useRef(false);

  // Preload Stripe.js early
  useEffect(() => {
    // Import and initialize Stripe.js early to improve performance
    import('@stripe/stripe-js').then(({ loadStripe }) => {
      loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');
    });
  }, []);

  // Preload setup intent when user reaches step 2 (parents) or step 3 (availability)
  // This ensures it's ready by the time they reach step 4 (payment method)
  useEffect(() => {
    // Only preload if we're on step 2 or 3, haven't already preloaded, and studentId exists
    const shouldPreload = (currentStep === 1 || currentStep === 2) && 
                          !preloadedClientSecret && 
                          !isPreloadingPayment &&
                          initialData.student.id;
    
    if (!shouldPreload) return;

    let cancelled = false;
    setIsPreloadingPayment(true);

    // Delay slightly to not block the current step render
    const timeoutId = setTimeout(() => {
      fetch('/api/register/payment-method', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          action: 'create_setup_intent',
        }),
      })
        .then(async (res) => {
          if (cancelled) return;
          
          const data = await res.json();
          if (!res.ok) {
            // Silently fail - this is just pre-warming, not critical
            // The actual setup intent will be created when step 4 mounts
            console.warn('[RegistrationFlow] Preload setup intent failed:', data.error);
            setIsPreloadingPayment(false);
            return;
          }
          
          if (!cancelled && data.client_secret) {
            setPreloadedClientSecret(data.client_secret);
            setIsPreloadingPayment(false);
          }
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          // Silently fail - this is just pre-warming, not critical
          console.warn('[RegistrationFlow] Preload setup intent error:', error);
          setIsPreloadingPayment(false);
        });
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [currentStep, preloadedClientSecret, isPreloadingPayment, initialData.student.id, token]);

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
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday_am: true,
        saturday_pm: true,
        sunday_am: true,
        sunday_pm: true,
      },
      password: '',
      confirmPassword: '',
      paymentMethodVerified: false,
      billingPolicyAgreed: false,
    },
  });

  const handleNext = async () => {
    // Validate current step before proceeding
    const fieldsToValidate: (keyof RegistrationFormValues)[] = [];
    
    // Steps: student(0), parents(1), availability(2), password(3), payment(4), confirm(5)
    // When skipPassword=true, password step shows "Enter your password" instead of "Create password"
    
    if (currentStep === 0) {
      fieldsToValidate.push('student');
    } else if (currentStep === 1) {
      fieldsToValidate.push('parents');
    } else if (currentStep === 2) {
      fieldsToValidate.push('availability');
    } else if (currentStep === 3) {
      // Password step - always validate password, but only validate confirmPassword if not skipping
      fieldsToValidate.push('password');
      if (!skipPassword) {
        fieldsToValidate.push('confirmPassword');
      }
    } else if (currentStep === 4) {
      fieldsToValidate.push('paymentMethodVerified', 'billingPolicyAgreed');
    }

    const isValid = await form.trigger(fieldsToValidate as Array<keyof RegistrationFormValues>);
    
    if (isValid) {
      onStepChange(currentStep + 1);
    }
    // Validation errors are shown inline via FormField FormMessage and step-specific error areas
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
      // Validation errors are shown inline via FormField FormMessage
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = form.getValues();
      
      const requestBody = {
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
        password: skipPassword ? formData.password : formData.password,
        confirmPassword: skipPassword ? undefined : formData.confirmPassword,
        skipPassword,
      };
      
      const response = await fetch('/api/register/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
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
        // Show the API error message directly
        toast({
          title: 'Registration Failed',
          description: data.error || 'Registration failed. Please try again.',
          variant: 'destructive',
        });
        throw new Error(data.error || 'Registration failed');
      }

      toast({
        title: 'Registration Successful!',
        description: skipPassword ? 'Redirecting to dashboard...' : 'Signing you in...',
      });

      // Sign in the user - either with newly created password or existing password
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

        // Use router.replace() for client-side navigation that replaces history entry
        // This prevents users from going back to registration page
        // Cookies are already set synchronously by signInWithPassword(), so no delay needed
        const redirectPath = data.redirectTo || '/dashboard';
        
        // Set redirecting flag BEFORE redirect to prevent state updates in finally block
        // Use a ref for synchronous access (state updates are async and may not be available in finally)
        isRedirectingRef.current = true;
        
        // Use router.replace() instead of window.location for:
        // 1. Client-side navigation (faster, no full page reload)
        // 2. Not affected by HMR reload signals in development
        // 3. Replaces history entry (prevents back navigation)
        router.replace(redirectPath);
        
        // Prevent any further execution that might interfere with redirect
        // Note: This return won't prevent finally block, but isRedirecting flag will
        return;
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
      // Only set submitting to false if we're not redirecting
      // This prevents React re-renders from interrupting the redirect
      // Use ref for synchronous access (state updates are async)
      if (!isRedirectingRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  return (
    <div className="container max-w-4xl py-8">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Complete Your Registration</h1>
          <p className="text-muted-foreground mt-2">
            Step {currentStep + 1} of {steps.length}: {steps[currentStep]?.title}
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
            {currentStep === 3 && (
              <RegistrationStep4Password form={form} skipPassword={skipPassword} />
            )}
            {currentStep === 4 ? (
                  <RegistrationStep4PaymentMethod 
                    form={form} 
                    token={token}
                    studentId={initialData.student.id}
                    preloadedClientSecret={preloadedClientSecret}
                  />
                ) : null}
            {currentStep === 5 && (
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
      </div>
    </div>
  );
}
