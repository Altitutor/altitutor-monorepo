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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';
import { AutomationConditionsBuilder } from '../AutomationConditionsBuilder';
import type { WizardFormData } from '../CreateAutomationRuleWizard';
import type { ActivityEventType } from '../../types';
import { ENTITY_TYPES, EVENT_TYPES } from '../../constants';

interface Step2TriggerProps {
  form: UseFormReturn<WizardFormData>;
}

export function Step2Trigger({ form }: Step2TriggerProps) {
  const selectedEventTypes = form.watch('event_types');
  const entityType = form.watch('entity_type');

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Trigger Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Configure when this automation rule should trigger.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-base">
          <span>When a</span>
          
          <FormField
            control={form.control}
            name="entity_type"
            render={({ field }) => (
              <FormItem className="w-[180px]">
                <FormControl>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Entity" />
                    </SelectTrigger>
                    <SelectContent>
                      {ENTITY_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <span>is</span>

          <FormField
            control={form.control}
            name="event_types"
            render={() => (
              <FormItem className="w-[140px]">
                <FormControl>
                  <Select
                    value={selectedEventTypes[0] || ''}
                    onValueChange={(value) => {
                      form.setValue('event_types', [value as ActivityEventType]);
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Event" />
                    </SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map((eventType) => (
                        <SelectItem key={eventType.value} value={eventType.value}>
                          {eventType.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {(selectedEventTypes[0] === 'CREATED' || selectedEventTypes[0] === 'UPDATED') && (
          <div className="mt-4">
            <FormField
              control={form.control}
              name="conditions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Optional Condition</FormLabel>
                  <FormDescription className="mb-3">
                    Add a condition to make the rule more specific. For example, only trigger when status equals "Active".
                  </FormDescription>
                  <FormControl>
                    <AutomationConditionsBuilder
                      conditions={field.value}
                      eventTypes={selectedEventTypes as ActivityEventType[]}
                      entityType={entityType}
                      onChange={(condition) => {
                        field.onChange(condition);
                      }}
                      inline={false}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}
      </div>
    </div>
  );
}
