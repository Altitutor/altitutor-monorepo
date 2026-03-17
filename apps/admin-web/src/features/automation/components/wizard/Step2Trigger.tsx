'use client';

import { UseFormReturn } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
  SearchableSelect,
} from '@altitutor/ui';
import { AutomationConditionsBuilder } from '../AutomationConditionsBuilder';
import type { WizardFormData } from '../CreateAutomationRuleWizard';
import type { ActivityEventType, AutomationCondition } from '../../types';
import { ENTITY_TYPES, EVENT_TYPES } from '../../constants';

interface Step2TriggerProps {
  form: UseFormReturn<WizardFormData>;
}

type EntityTypeOption = (typeof ENTITY_TYPES)[number];
type EventTypeOption = (typeof EVENT_TYPES)[number];

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
            render={({ field }) => {
              const entity = ENTITY_TYPES.find((t) => t.value === field.value) ?? null;
              return (
              <FormItem className="w-[180px]">
                <FormControl>
                  <SearchableSelect<EntityTypeOption>
                    items={ENTITY_TYPES}
                    value={entity}
                    onValueChange={(item) => field.onChange(item?.value ?? '')}
                    getItemLabel={(t) => t.label}
                    getItemId={(t) => t.value}
                    placeholder="Entity"
                    triggerClassName="h-9"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
              );
            }}
          />

          <span>is</span>

          <FormField
            control={form.control}
            name="event_types"
            render={({ field }) => {
              const event =
                EVENT_TYPES.find((t) => t.value === (field.value?.[0] ?? '')) ?? null;
              return (
              <FormItem className="w-[140px]">
                <FormControl>
                  <SearchableSelect<EventTypeOption>
                    items={EVENT_TYPES}
                    value={event}
                    onValueChange={(item) => {
                      field.onChange(
                        item ? [item.value as ActivityEventType] : []
                      );
                    }}
                    getItemLabel={(t) => t.label}
                    getItemId={(t) => t.value}
                    placeholder="Event"
                    triggerClassName="h-9"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
              );
            }}
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
                      conditions={field.value as AutomationCondition | null}
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
