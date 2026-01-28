'use client';

import { UseFormReturn } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Textarea } from '@altitutor/ui';
import { Switch } from '@altitutor/ui';
import type { WizardFormData } from '../CreateAutomationRuleWizard';

interface Step1BasicInfoProps {
  form: UseFormReturn<WizardFormData>;
}

export function Step1BasicInfo({ form }: Step1BasicInfoProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Basic Information</h3>
        <p className="text-sm text-muted-foreground">
          Give your automation rule a name and configure basic settings.
        </p>
      </div>

      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Rule Name *</FormLabel>
            <FormControl>
              <Input
                placeholder="e.g., Notify on Student Signup"
                {...field}
              />
            </FormControl>
            <FormDescription>
              A descriptive name to help you identify this rule later
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Describe what this rule does..."
                {...field}
                rows={3}
              />
            </FormControl>
            <FormDescription>
              Optional description to help you remember the purpose of this rule
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="flex items-start gap-6">
        <FormField
          control={form.control}
          name="priority"
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel>Priority</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                />
              </FormControl>
              <FormDescription>
                Higher priority rules run first when multiple rules match
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="enabled"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-4 flex-1">
              <div className="space-y-0.5">
                <FormLabel>Enabled</FormLabel>
                <FormDescription>
                  Disable to temporarily stop this rule from running
                </FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
