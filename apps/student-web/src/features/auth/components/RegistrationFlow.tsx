'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
    subject_ids: z.array(z.string().uuid()).min(1, 'Please select at least one subject'),
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
  confirmPassword: z.string().optional(),
  // Payment method verification
  paymentMethodVerified: z.boolean(),
}).refine((data) => {
  // Only validate password match if confirmPassword is provided (i.e., not skipping password step)
  if (data.confirmPassword === undefined || data.confirmPassword === '') {
    return true; // Skip validation if confirmPassword is not provided
  }
  return data.password === data.confirmPassword;
}, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
}).refine(
  (data) => data.parents.some((p) => p.email && p.email.trim() !== '' && p.phone && p.phone.trim() !== ''),
  { message: 'At least one parent must have both email and phone', path: ['parents'] }
).refine(
  (data) => data.paymentMethodVerified === true,
  { message: 'Payment method must be verified', path: ['paymentMethodVerified'] }
).superRefine((data, ctx) => {
  // Require both curriculum and year_level to be selected
  if (!data.student.curriculum) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Please select a curriculum',
      path: ['student', 'curriculum'],
    });
  }
  if (data.student.year_level === undefined || data.student.year_level === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Please select a year level',
      path: ['student', 'year_level'],
    });
  }
});

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
  { id: 'payment', title: 'Payment Method' },
  { id: 'confirm', title: 'Confirm' },
];

// Helper function to extract all validation errors from form state
function extractValidationErrors(errors: any, path: string = ''): string[] {
  const errorMessages: string[] = [];
  
  if (!errors || typeof errors !== 'object') {
    return errorMessages;
  }
  
  // Handle root-level error messages
  if ('message' in errors && typeof errors.message === 'string') {
    const fieldName = path || 'Form';
    errorMessages.push(`${fieldName}: ${errors.message}`);
  }
  
  for (const [key, value] of Object.entries(errors)) {
    // Skip the message property if we already handled it
    if (key === 'message') {
      continue;
    }
    
    const currentPath = path ? `${path}.${key}` : key;
    
    if (value && typeof value === 'object') {
      // Check if it's an error object with a message
      if ('message' in value && typeof value.message === 'string') {
        // Format field name nicely
        let fieldName = currentPath;
        if (currentPath.includes('.')) {
          const parts = currentPath.split('.');
          const lastPart = parts[parts.length - 1];
          // Convert snake_case to Title Case
          fieldName = lastPart
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        } else {
          fieldName = currentPath.charAt(0).toUpperCase() + currentPath.slice(1);
        }
        
        // Special handling for common fields
        if (currentPath.startsWith('student.')) {
          fieldName = `Student ${fieldName.replace('student.', '')}`;
        } else if (currentPath.startsWith('parents.')) {
          const match = currentPath.match(/parents\.(\d+)\.(.+)/);
          if (match) {
            const parentIndex = parseInt(match[1], 10) + 1;
            const field = match[2].split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            fieldName = `Parent ${parentIndex} ${field}`;
          }
        } else if (currentPath === 'availability') {
          fieldName = 'Availability';
        } else if (currentPath === 'password') {
          fieldName = 'Password';
        } else if (currentPath === 'confirmPassword') {
          fieldName = 'Confirm Password';
        } else if (currentPath === 'paymentMethodVerified') {
          fieldName = 'Payment Method';
        }
        
        errorMessages.push(`${fieldName}: ${value.message}`);
      } else if (Array.isArray(value)) {
        // Handle array errors (e.g., parents array)
        value.forEach((item, index) => {
          if (item && typeof item === 'object') {
            const arrayErrors = extractValidationErrors(item, `${currentPath}[${index}]`);
            errorMessages.push(...arrayErrors);
          } else if (item && typeof item === 'string') {
            // Direct array error message
            errorMessages.push(`${currentPath}: ${item}`);
          }
        });
      } else {
        // Recursively extract nested errors
        const nestedErrors = extractValidationErrors(value, currentPath);
        errorMessages.push(...nestedErrors);
      }
    } else if (typeof value === 'string') {
      // Direct string error
      errorMessages.push(`${currentPath}: ${value}`);
    }
  }
  
  return errorMessages;
}

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
    },
  });

  const handleNext = async () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RegistrationFlow.tsx:255',message:'handleNext called',data:{currentStep,skipPassword},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    
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
      // Payment method step - verify payment method is verified
      const paymentMethodVerified = form.getValues('paymentMethodVerified');
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RegistrationFlow.tsx:274',message:'Payment method check',data:{paymentMethodVerified},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (!paymentMethodVerified) {
        toast({
          title: 'Payment Method Required',
          description: 'Please add and verify a payment method before proceeding.',
          variant: 'destructive',
        });
        return;
      }
      fieldsToValidate.push('paymentMethodVerified');
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RegistrationFlow.tsx:286',message:'Before validation trigger',data:{fieldsToValidate},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    
    const isValid = await form.trigger(fieldsToValidate as Array<keyof RegistrationFormValues>);
    
    // #region agent log
    const formValues = form.getValues();
    const formErrors = form.formState.errors;
    fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RegistrationFlow.tsx:290',message:'After validation trigger',data:{isValid,formValues,formErrors:JSON.stringify(formErrors)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    
    if (isValid) {
      onStepChange(currentStep + 1);
    } else {
      // Extract all validation errors
      const errors = form.formState.errors;
      const errorMessages = extractValidationErrors(errors);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RegistrationFlow.tsx:298',message:'Validation failed',data:{errorMessages,errors:JSON.stringify(errors)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      
      if (errorMessages.length > 0) {
        toast({
          title: 'Please fix the following errors',
          description: errorMessages.join('. '),
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Please fix the errors',
          description: 'Some fields are invalid. Please check and try again.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      onStepChange(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RegistrationFlow.tsx:347',message:'handleSubmit called',data:{isSubmitting},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    
    // Prevent multiple submissions
    if (isSubmitting) {
      return;
    }

    // Verify payment method before submitting
    const paymentMethodVerified = form.getValues('paymentMethodVerified');
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RegistrationFlow.tsx:354',message:'Payment method check in submit',data:{paymentMethodVerified},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (!paymentMethodVerified) {
      toast({
        title: 'Payment Method Required',
        description: 'Please add and verify a payment method before completing registration.',
        variant: 'destructive',
      });
      return;
    }

    // #region agent log
    const formValuesBeforeValidation = form.getValues();
    fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RegistrationFlow.tsx:364',message:'Before full form validation',data:{formValues:JSON.stringify(formValuesBeforeValidation)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    
    const isValid = await form.trigger();
    
    // #region agent log
    const formErrorsAfterValidation = form.formState.errors;
    fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RegistrationFlow.tsx:368',message:'After full form validation',data:{isValid,formErrors:JSON.stringify(formErrorsAfterValidation)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    
    if (!isValid) {
      // Extract all validation errors
      const errors = form.formState.errors;
      const errorMessages = extractValidationErrors(errors);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RegistrationFlow.tsx:375',message:'Validation failed in submit',data:{errorMessages,errors:JSON.stringify(errors)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      
      if (errorMessages.length > 0) {
        toast({
          title: 'Please fix the following errors',
          description: errorMessages.join('. '),
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Please fix the errors',
          description: 'Some fields are invalid. Please check and try again.',
          variant: 'destructive',
        });
      }
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
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RegistrationFlow.tsx:495',message:'Sending registration request',data:{requestBody:JSON.stringify(requestBody),skipPassword},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      
      const response = await fetch('/api/register/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RegistrationFlow.tsx:520',message:'Registration API response',data:{ok:response.ok,status:response.status,data:JSON.stringify(data)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

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
