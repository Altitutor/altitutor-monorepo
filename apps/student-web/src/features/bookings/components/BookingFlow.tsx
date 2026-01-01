'use client';

import { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Loader2, Calendar, Clock } from 'lucide-react';
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
  selectedSlot?: { startAt: string; endAt: string } | null;
}

export function BookingFlow({
  title,
  description,
  steps,
  currentStep,
  onStepChange,
  onNext,
  onBack,
  onConfirm,
  isSubmitting = false,
  canProceed = true,
  selectedSlot,
}: BookingFlowProps) {
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
        <h1 className="text-2xl font-bold">{title}</h1>
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

      {/* Booking Summary Card - Show after time is selected */}
      {selectedSlot && currentStep > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-5 w-5" />
                <span className="font-medium">
                  {new Date(selectedSlot.startAt).toLocaleDateString('en-AU', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    timeZone: 'Australia/Adelaide',
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-5 w-5" />
                <span className="font-medium">
                  {new Date(selectedSlot.startAt).toLocaleTimeString('en-AU', {
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZone: 'Australia/Adelaide',
                  })} - {new Date(selectedSlot.endAt).toLocaleTimeString('en-AU', {
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZone: 'Australia/Adelaide',
                  })}
                </span>
              </div>
              <div className="text-muted-foreground">
                <span className="font-medium">{durationMinutes} minutes</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Step Content */}
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
                  disabled={!canProceed || isSubmitting}
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
    </div>
  );
}

