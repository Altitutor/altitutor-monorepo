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
  Input,
} from '@altitutor/ui';
import { AutomationConditionsBuilder } from '../AutomationConditionsBuilder';
import type { WizardFormData } from '../CreateAutomationRuleWizard';
import type { ActivityEventType, AutomationConditionExpression } from '../../types';
import { ENTITY_TYPES, EVENT_TYPES } from '../../constants';

interface Step2TriggerProps {
  form: UseFormReturn<WizardFormData>;
}

type EntityTypeOption = (typeof ENTITY_TYPES)[number];
type EventTypeOption = (typeof EVENT_TYPES)[number];

export function Step2Trigger({ form }: Step2TriggerProps) {
  const selectedEventTypes = form.watch('event_types');
  const entityType = form.watch('entity_type');
  const triggerKind = form.watch('trigger_kind');

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Trigger Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Configure when this automation rule should trigger.
        </p>
      </div>

      <div className="space-y-4">
        <FormField
          control={form.control}
          name="trigger_kind"
          render={({ field }) => {
            const options = [
              { value: 'EVENT' as const, label: 'Entity event' },
              { value: 'RELATIVE_TIME' as const, label: 'Before session start' },
            ];
            return (
              <FormItem className="max-w-sm">
                <FormLabel>Trigger type</FormLabel>
                <FormControl>
                  <SearchableSelect
                    items={options}
                    value={options.find((option) => option.value === field.value) ?? options[0]}
                    onValueChange={(item) => {
                      const next = item?.value ?? 'EVENT';
                      field.onChange(next);
                      if (next === 'RELATIVE_TIME') {
                        form.setValue('entity_type', 'sessions');
                        form.setValue('event_types', ['SCHEDULED']);
                      } else if (form.getValues('event_types')[0] === 'SCHEDULED') {
                        form.setValue('event_types', ['CREATED']);
                      }
                    }}
                    getItemLabel={(option) => option.label}
                    getItemId={(option) => option.value}
                  />
                </FormControl>
              </FormItem>
            );
          }}
        />

        {triggerKind === 'RELATIVE_TIME' && (
          <FormField
            control={form.control}
            name="trigger_config.offset_minutes"
            render={({ field }) => (
              <FormItem className="max-w-xs">
                <FormLabel>Hours before session</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    max={8760}
                    value={field.value / 60}
                    onChange={(event) => field.onChange(Math.round(Number(event.target.value) * 60))}
                  />
                </FormControl>
                <FormDescription>Use 24 hours for a one-day reminder.</FormDescription>
              </FormItem>
            )}
          />
        )}

        {triggerKind === 'EVENT' && (
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
        )}

        {(triggerKind === 'RELATIVE_TIME' || selectedEventTypes[0] === 'CREATED' || selectedEventTypes[0] === 'UPDATED') && (
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
                      conditions={field.value as AutomationConditionExpression | null}
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
