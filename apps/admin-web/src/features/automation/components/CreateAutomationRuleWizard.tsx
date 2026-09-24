'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@altitutor/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCreateAutomationRule } from '../api/mutations';
import { useMessageTemplates } from '@/features/messages/api/templates';
import { useStaffMinimal } from '@/features/staff/hooks/useStaffQuery';
import { useCurrentStaff } from '@/shared/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { Form } from '@altitutor/ui';
import { AdminDialogShell } from '@/shared/components';
import { cn } from '@/shared/utils';
import type { ActivityEntityType, DomainEventName, AutomationRuleInsert } from '../types';
import type { AutomationConditionExpression } from '../types';
import { Step1BasicInfo } from './wizard/Step1BasicInfo';
import { Step2Trigger } from './wizard/Step2Trigger';
import { Step3Actions } from './wizard/Step3Actions';
import { Step4Review } from './wizard/Step4Review';

const ruleFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string(),
  entity_type: z.string().min(1, 'Entity type is required'),
  event_names: z.array(z.string()),
  trigger_kind: z.enum(['EVENT', 'RELATIVE_TIME']),
  trigger_config: z.object({
    anchor: z.literal('session.start_at'),
    offset_minutes: z.number().int().min(0).max(525600),
  }),
  enabled: z.boolean(),
  priority: z.number().int().min(0),
  conditions: z.custom<AutomationConditionExpression | null>().optional().nullable(),
}).superRefine((value, context) => {
  if (value.trigger_kind === 'EVENT' && value.event_names.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['event_names'],
      message: 'A lifecycle event is required',
    });
  }
});

export type WizardFormData = z.infer<typeof ruleFormSchema>;

interface CreateAutomationRuleWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const TOTAL_STEPS = 4;

export function CreateAutomationRuleWizard({
  isOpen,
  onClose,
  onSuccess,
}: CreateAutomationRuleWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [createdRuleId, setCreatedRuleId] = useState<string | null>(null);
  const createMutation = useCreateAutomationRule();
  const queryClient = useQueryClient();
  const { data: templates } = useMessageTemplates();
  const { data: staffData } = useStaffMinimal(
    { limit: 100, orderBy: 'first_name', ascending: true },
    { enabled: isOpen }
  );
  const staffList = staffData?.staff ?? [];
  const { data: currentStaff } = useCurrentStaff();

  const form = useForm<WizardFormData>({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: {
      name: '',
      description: '',
      entity_type: 'students',
      event_names: ['student.created'],
      trigger_kind: 'EVENT',
      trigger_config: { anchor: 'session.start_at', offset_minutes: 1440 },
      enabled: true,
      priority: 0,
      conditions: null as AutomationConditionExpression | null,
    },
  });

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0);
      setCreatedRuleId(null);
      form.reset({
        name: '',
        description: '',
        entity_type: 'students',
        event_names: ['student.created'],
        trigger_kind: 'EVENT',
        trigger_config: { anchor: 'session.start_at', offset_minutes: 1440 },
        enabled: true,
        priority: 0,
        conditions: null,
      });
    }
  }, [isOpen, form]);

  const handleNext = async () => {
    // Validate current step before proceeding
    const fieldsToValidate = getFieldsForStep(currentStep);
    const isValid = await form.trigger(fieldsToValidate as Array<keyof WizardFormData>);
    
    if (!isValid) {
      return;
    }

    // If on step 2 (trigger), create the rule before moving to actions
    if (currentStep === 1 && !createdRuleId) {
      const formData = form.getValues();
      try {
        const newRule = await createMutation.mutateAsync({
          name: formData.name,
          description: formData.description || null,
          entity_type: formData.entity_type as ActivityEntityType,
          event_names: formData.trigger_kind === 'EVENT'
            ? formData.event_names as DomainEventName[]
            : [],
          trigger_kind: formData.trigger_kind,
          trigger_config: formData.trigger_config,
          enabled: formData.enabled,
          priority: formData.priority,
          conditions: (formData.conditions ?? null) as AutomationRuleInsert['conditions'],
          created_by: currentStaff?.id ?? null,
        });
        setCreatedRuleId(newRule.id);
        await queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      } catch (error) {
        // Error handling is done in mutations
        return;
      }
    }

    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = () => {
    queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
    onSuccess?.();
    onClose();
  };

  const handleClose = () => {
    if (createdRuleId) {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
    }
    onClose();
  };

  const getFieldsForStep = (step: number): (keyof WizardFormData)[] => {
    switch (step) {
      case 0: // Basic Info
        return ['name', 'priority', 'enabled'];
      case 1: // Trigger
        return ['entity_type', 'event_names'];
      case 2: // Actions (no validation needed, actions are optional)
        return [];
      case 3: // Review (no validation needed)
        return [];
      default:
        return [];
    }
  };

  const getStepTitle = (step: number): string => {
    const titles = [
      'Basic Information',
      'Trigger Configuration',
      'Actions',
      'Review',
    ];
    return titles[step] || '';
  };

  const isLoading = createMutation.isPending;
  const formValues = form.watch();

  return (
    <AdminDialogShell
      fillHeight
      open={isOpen}
      onClose={handleClose}
      title="Create Automation Rule"
      subtitle={`Step ${currentStep + 1} of ${TOTAL_STEPS}: ${getStepTitle(currentStep)}`}
      contentClassName="md:max-w-4xl"
      bodyClassName="min-h-0"
      headerExtra={
        <div className="px-6 pb-4">
          <div className="flex items-center gap-2">
            {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
              <div
                key={index}
                className={cn(
                  'flex-1 h-2 rounded-full transition-colors',
                  index < currentStep
                    ? 'bg-primary'
                    : index === currentStep
                      ? 'bg-primary/50'
                      : 'bg-muted'
                )}
              />
            ))}
          </div>
        </div>
      }
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <div>
            {currentStep > 0 && (
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={isLoading}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            {currentStep < TOTAL_STEPS - 1 ? (
              <Button onClick={handleNext} disabled={isLoading}>
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleFinish} disabled={isLoading || !createdRuleId}>
                Create Rule
              </Button>
            )}
          </div>
        </div>
      }
    >
      <Form {...form}>
        {currentStep === 0 && (
          <Step1BasicInfo form={form} />
        )}
        {currentStep === 1 && (
          <Step2Trigger form={form} />
        )}
        {currentStep === 2 && (
          <Step3Actions
            ruleId={createdRuleId}
            entityType={formValues.entity_type as ActivityEntityType}
            templates={templates || []}
            staffList={staffList}
          />
        )}
        {currentStep === 3 && (
          <Step4Review
            formData={formValues}
            ruleId={createdRuleId}
            templates={templates || []}
          />
        )}
      </Form>
    </AdminDialogShell>
  );
}
