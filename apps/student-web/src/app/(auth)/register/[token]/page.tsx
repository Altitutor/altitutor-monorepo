'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RegistrationFlow } from '@/features/auth/components/RegistrationFlow';
import { useToast } from '@altitutor/ui';
import { Loader2 } from 'lucide-react';

type RegistrationData = {
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

export default function RegisterPage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [registrationData, setRegistrationData] = useState<RegistrationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skipPassword, setSkipPassword] = useState(false);
  const [currentStep, setCurrentStep] = useState(() => {
    const stepParam = searchParams.get('step');
    return stepParam ? parseInt(stepParam, 10) : 0;
  });

  // Validate token and fetch registration data
  useEffect(() => {
    const validateToken = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/register/validate?token=${params.token}`);
        const data = await response.json();

        if (!response.ok || !data.valid) {
          if (data.alreadyRegistered) {
            // Student already registered - redirect to login
            toast({
              title: 'Already Registered',
              description: 'You already have an account. Please log in.',
              variant: 'default',
            });
            router.push('/login');
            return;
          }
          setError(data.error || 'Invalid or expired registration link');
          return;
        }

        setRegistrationData({
          student: data.student,
          parents: data.parents || [],
          subjects: data.subjects || [],
        });
        setSkipPassword(data.skipPassword || data.hasAccount || false);
      } catch (err) {
        console.error('Failed to validate token:', err);
        setError('Failed to load registration form. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    validateToken();
  }, [params.token, router, toast]);

  // Sync query params with step state
  useEffect(() => {
    const urlParams = new URLSearchParams();
    urlParams.set('step', currentStep.toString());
    router.replace(`/register/${params.token}?${urlParams.toString()}`, { scroll: false });
  }, [currentStep, router, params.token]);

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading registration form...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Registration Error</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <button
            onClick={() => router.push('/login')}
            className="text-primary hover:underline"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (!registrationData) {
    return null;
  }

  return (
    <RegistrationFlow
      token={params.token}
      initialData={registrationData}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      skipPassword={skipPassword}
    />
  );
}
