'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Textarea } from '@altitutor/ui';
import { SearchableSelect } from '@altitutor/ui';
import { ScrollArea } from '@altitutor/ui';
import { Switch } from '@altitutor/ui';
import { SegmentedControl, SegmentedTabPanelContent } from '@altitutor/ui';
import { Loader2, X } from 'lucide-react';
import { useUpdateAutomationRule } from '../api/mutations';
import { useAutomationRule } from '../api/queries';
import { useMessageTemplates } from '@/features/messages/api/templates';
import { useStaffMinimal } from '@/features/staff/hooks/useStaffQuery';
import type { AutomationRuleWithActions, ActivityEntityType, ActivityEventType } from '../types';
import { AutomationActionsList } from './AutomationActionsList';
import { AutomationConditionsBuilder } from './AutomationConditionsBuilder';
import type { AutomationConditionExpression } from '../types';
import { ENTITY_TYPES, EVENT_TYPES } from '../constants';
import {
  ExpandButton,
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
} from '@/shared/components/expandable-dialog';
import { cn } from '@/shared/utils';

const ruleFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().default(''),
  entity_type: z.string().min(1, 'Entity type is required'),
  event_types: z.array(z.string()).min(1, 'At least one event type is required'),
  trigger_kind: z.enum(['EVENT', 'RELATIVE_TIME']),
  trigger_config: z.object({
    anchor: z.literal('session.start_at'),
    offset_minutes: z.number().int().min(0).max(525600),
  }),
  enabled: z.boolean(),
  priority: z.number().int().min(0),
  conditions: z.any().optional().nullable(),
});

interface EditAutomationRuleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  rule: AutomationRuleWithActions;
}

export function EditAutomationRuleDialog({
  isOpen,
  onClose,
  rule,
}: EditAutomationRuleDialogProps) {
  const updateMutation = useUpdateAutomationRule();
  const { data: existingRule } = useAutomationRule(rule.id, isOpen);
  const { data: templates } = useMessageTemplates();
  const { data: staffData } = useStaffMinimal(
    { limit: 100, orderBy: 'first_name', ascending: true },
    { enabled: isOpen }
  );
  const staffList = staffData?.staff ?? [];
  const [activeTab, setActiveTab] = useState<string>('details');
  const [expanded, setExpanded] = useState(false);

  const form = useForm({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: {
      name: '',
      description: '',
      entity_type: 'tasks',
      event_types: ['CREATED'],
      trigger_kind: 'EVENT' as const,
      trigger_config: { anchor: 'session.start_at' as const, offset_minutes: 1440 },
      enabled: true,
      priority: 0,
      conditions: null as AutomationConditionExpression | null,
    },
  });

  useEffect(() => {
    if (!isOpen) setExpanded(false);
  }, [isOpen]);

  // Initialize form when editing
  useEffect(() => {
    if (isOpen && existingRule) {
      const storedTriggerConfig = existingRule.trigger_config;
      const configRecord = storedTriggerConfig && typeof storedTriggerConfig === 'object' &&
        !Array.isArray(storedTriggerConfig)
        ? storedTriggerConfig as Record<string, unknown>
        : null;
      const offsetMinutes = typeof configRecord?.offset_minutes === 'number'
        ? configRecord.offset_minutes
        : 1440;
      form.reset({
        name: existingRule.name,
        description: existingRule.description || '',
        entity_type: existingRule.entity_type as ActivityEntityType,
        event_types: existingRule.event_types as ActivityEventType[],
        trigger_kind: existingRule.trigger_kind === 'RELATIVE_TIME' ? 'RELATIVE_TIME' : 'EVENT',
        trigger_config: { anchor: 'session.start_at', offset_minutes: offsetMinutes },
        enabled: existingRule.enabled ?? true,
        priority: existingRule.priority ?? 0,
        conditions: (existingRule.conditions as AutomationConditionExpression | null) || null,
      });
      setActiveTab('details');
    }
  }, [isOpen, existingRule, form]);

  const selectedEventTypes = form.watch('event_types');
  const triggerKind = form.watch('trigger_kind');

  const onSubmit = async (data: z.infer<typeof ruleFormSchema>) => {
    try {
      await updateMutation.mutateAsync({
        id: rule.id,
        updates: {
          name: data.name,
          description: data.description || null,
          entity_type: data.entity_type,
          event_types: data.event_types,
          trigger_kind: data.trigger_kind,
          trigger_config: data.trigger_config,
          enabled: data.enabled,
          priority: data.priority,
          conditions: data.conditions || null,
        },
      });
    } catch (error) {
      // Error handling is done in mutations
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const isLoading = updateMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className={cn(
          'w-full md:max-w-4xl h-[90vh] flex flex-col p-0 [&>button]:hidden',
          EXPANDABLE_DIALOG_TRANSITION,
          expanded && EXPANDED_DIALOG_CONTENT_CLASS
        )}
      >
        <div className="flex flex-col h-full min-h-0">
          {/* Sticky Header */}
          <div className="flex-shrink-0 border-b bg-background">
            <DialogHeader className="px-6 pt-6 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleClose}
                    className="shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <div className="flex-1">
                    <DialogTitle>Edit Automation Rule</DialogTitle>
                    <DialogDescription>
                      Update the automation rule and its actions.
                    </DialogDescription>
                  </div>
                  <ExpandButton expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
                </div>
              </div>
            </DialogHeader>
            <div className="px-6 pb-4">
              <SegmentedControl
                fullWidth
                value={activeTab}
                onValueChange={setActiveTab}
                options={[
                  { value: 'details', label: 'Details' },
                  { value: 'trigger', label: 'Trigger' },
                  { value: 'actions', label: 'Actions' },
                ]}
              />
            </div>
          </div>

          <div className="flex-1 overflow-hidden min-h-0">
            <ScrollArea className="h-full">
              <div className="p-6">
                <Form {...form}>
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (activeTab !== 'actions') {
                        form.handleSubmit(onSubmit)(e);
                      }
                    }} 
                    className="space-y-6"
                  >
                    {/* Details Tab */}
                    <SegmentedTabPanelContent when="details" activeTab={activeTab} className="space-y-6">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rule Name</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Notify on Task Creation" {...field} />
                            </FormControl>
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
                              <FormDescription>Higher priority rules run first</FormDescription>
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
                    </SegmentedTabPanelContent>

                    {/* Trigger Tab */}
                    <SegmentedTabPanelContent when="trigger" activeTab={activeTab} className="space-y-6">
                      <div className="space-y-4">
                        <div className="text-sm text-muted-foreground mb-4">
                          Configure when this automation rule should trigger
                        </div>

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
                                    getItemId={(option) => option.value}
                                    getItemLabel={(option) => option.label}
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
                              const selected = ENTITY_TYPES.find((t) => t.value === field.value) ?? null;
                              return (
                                <FormItem className="w-[180px]">
                                  <FormControl>
                                    <SearchableSelect<typeof ENTITY_TYPES[number]>
                                      items={[...ENTITY_TYPES]}
                                      value={selected}
                                      onValueChange={(item) => field.onChange(item?.value)}
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
                            render={() => {
                              const selected = EVENT_TYPES.find((t) => t.value === selectedEventTypes[0]) ?? null;
                              return (
                                <FormItem className="w-[140px]">
                                  <FormControl>
                                    <SearchableSelect<typeof EVENT_TYPES[number]>
                                      items={[...EVENT_TYPES]}
                                      value={selected}
                                      onValueChange={(item) => {
                                        form.setValue('event_types', item ? [item.value] : []);
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

                          {(selectedEventTypes[0] === 'CREATED' || selectedEventTypes[0] === 'UPDATED' || selectedEventTypes[0] === 'SCHEDULED') && (
                            <FormField
                              control={form.control}
                              name="conditions"
                              render={({ field }) => (
                                <FormItem className="w-full basis-full pt-3">
                                  <FormLabel>Conditions</FormLabel>
                                  <FormControl>
                                    <AutomationConditionsBuilder
                                      conditions={field.value}
                                      eventTypes={selectedEventTypes as ActivityEventType[]}
                                      entityType={form.watch('entity_type')}
                                      onChange={field.onChange}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                        </div>
                        )}

                        {triggerKind === 'RELATIVE_TIME' && (
                          <FormField
                            control={form.control}
                            name="conditions"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Conditions</FormLabel>
                                <FormControl>
                                  <AutomationConditionsBuilder
                                    conditions={field.value}
                                    eventTypes={['SCHEDULED']}
                                    entityType="sessions"
                                    onChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        )}
                      </div>
                    </SegmentedTabPanelContent>

                    {/* Actions Tab */}
                    <SegmentedTabPanelContent when="actions" activeTab={activeTab} className="space-y-6">
                      <div>
                        {rule.id && (
                          <AutomationActionsList
                            ruleId={rule.id}
                            templates={templates || []}
                            staffList={staffList}
                          />
                        )}
                      </div>
                    </SegmentedTabPanelContent>
                  </form>
                </Form>
              </div>
            </ScrollArea>
          </div>
        
          <div className="flex-shrink-0 px-6 py-4 border-t flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isLoading}>
              {activeTab === 'actions' ? 'Close' : 'Cancel'}
            </Button>
            {activeTab !== 'actions' && (
              <Button onClick={form.handleSubmit(onSubmit)} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Rule
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
