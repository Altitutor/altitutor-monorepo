'use client';

import { ReactNode } from 'react';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import { Loader2 } from 'lucide-react';
import { cn } from '@/shared/utils';

interface BookingFlowProps {
  title: string;
  description?: string;
  steps: Array<{
    id: string;
    title: string;
    component: ReactNode;
  }>;
  currentStep: number;
  onStepChange?: (step: number) => void;
  onNext?: () => void;
  onBack?: () => void;
  onConfirm?: () => void;
  isSubmitting?: boolean;
  canProceed?: boolean;
  selectedSlot?: { startAt: string; endAt: string; availableStaffIds?: string[] } | null;
}

export function BookingFlow({
  title,
  description,
  steps,
  currentStep,
  onStepChange: _onStepChange,
  onNext,
  onBack,
  onConfirm,
  isSubmitting = false,
  canProceed = true,
  selectedSlot,
}: BookingFlowProps) {
  const { resolvedTheme } = useTheme();
  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  // Calculate duration in minutes
  const durationMinutes = selectedSlot
    ? Math.round((new Date(selectedSlot.endAt).getTime() - new Date(selectedSlot.startAt).getTime()) / (1000 * 60))
    : 60;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">{title}</h1>
          <div className="flex-shrink-0 h-12 flex items-center">
            <Image 
              src={resolvedTheme === 'dark' ? "/images/logo-banner-dark.svg" : "/images/logo-banner-light.svg"}
              alt="Altitutor Student" 
              width={160} 
              height={36}
              priority
              className="object-contain"
              style={{ height: 'auto' }}
            />
          </div>
        </div>
        {description && <p className="text-muted-foreground mt-2">{description}</p>}
      </div>

      {/* Step Indicator - Centered */}
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

      {/* Pills for date/time and duration - Show only in details step (step 2) */}
      {selectedSlot && currentStep === 2 && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="text-sm py-1.5 px-3">
            {new Date(selectedSlot.startAt).toLocaleDateString('en-AU', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              timeZone: 'Australia/Adelaide',
            })}, {new Date(selectedSlot.startAt).toLocaleTimeString('en-AU', {
              hour: 'numeric',
              minute: '2-digit',
              timeZone: 'Australia/Adelaide',
            })} - {new Date(selectedSlot.endAt).toLocaleTimeString('en-AU', {
              hour: 'numeric',
              minute: '2-digit',
              timeZone: 'Australia/Adelaide',
            })}
          </Badge>
          <Badge variant="secondary" className="text-sm py-1.5 px-3">
            {durationMinutes}m
          </Badge>
        </div>
      )}

      {/* Current Step Content */}
      {currentStep === 0 || currentStep === 1 || currentStep === 2 || currentStep === 3 ? (
        // No card wrapper for mobile-friendly steps
        <div className="space-y-6">
          {currentStepData.component}
          
          {/* Navigation Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            {!isFirstStep && (
              <Button
                variant="outline"
                onClick={onBack}
                disabled={isSubmitting}
              >
                Back
              </Button>
            )}
            <div className="flex-1" />
            {!isLastStep ? (
              <Button
                onClick={onNext}
                disabled={isSubmitting}
                className={cn(
                  !canProceed && 'opacity-50 cursor-not-allowed'
                )}
              >
                Next
              </Button>
            ) : (
              <Button
                onClick={onConfirm}
                disabled={!canProceed || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  'Confirm Booking'
                )}
              </Button>
            )}
          </div>
        </div>
      ) : (
        // Fallback card wrapper for any other steps
        <Card>
          <CardHeader>
            <CardTitle>{currentStepData.title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {currentStepData.component}
              
              {/* Navigation Buttons */}
              <div className="flex gap-2 pt-4 border-t">
                {!isFirstStep && (
                  <Button
                    variant="outline"
                    onClick={onBack}
                    disabled={isSubmitting}
                  >
                    Back
                  </Button>
                )}
                <div className="flex-1" />
                {!isLastStep ? (
                  <Button
                    onClick={onNext}
                    disabled={isSubmitting}
                    className={cn(
                      !canProceed && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    onClick={onConfirm}
                    disabled={!canProceed || isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Confirming...
                      </>
                    ) : (
                      'Confirm Booking'
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

