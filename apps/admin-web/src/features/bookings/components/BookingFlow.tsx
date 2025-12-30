'use client';

import { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@altitutor/ui';
import { cn } from '@altitutor/ui';

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
}

export function BookingFlow({
  title,
  description,
  steps,
  currentStep,
  onStepChange,
}: BookingFlowProps) {
  const currentStepData = steps[currentStep];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && <p className="text-muted-foreground mt-2">{description}</p>}
      </div>

      {/* Step Indicator */}
      <div className="flex items-center space-x-2">
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
        <CardHeader>
          <CardTitle>{currentStepData.title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>{currentStepData.component}</CardContent>
      </Card>
    </div>
  );
}

