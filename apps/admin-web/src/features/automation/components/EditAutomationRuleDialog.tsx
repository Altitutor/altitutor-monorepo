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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';
import { ScrollArea } from '@altitutor/ui';
import { Switch } from '@altitutor/ui';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@altitutor/ui';
import { Loader2, X } from 'lucide-react';
import { useUpdateAutomationRule } from '../api/mutations';
import { useAutomationRule } from '../api/queries';
import { useMessageTemplates } from '@/features/messages/api/templates';
import { staffApi } from '@/features/staff/api/staff';
import type { AutomationRuleWithActions, ActivityEntityType, ActivityEventType } from '../types';
import { AutomationActionsList } from './AutomationActionsList';
import { AutomationConditionsBuilder } from './AutomationConditionsBuilder';
import type { AutomationCondition } from '../types';
import { ENTITY_TYPES, EVENT_TYPES } from '../constants';

const ruleFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().default(''),
  entity_type: z.string().min(1, 'Entity type is required'),
  event_types: z.array(z.string()).min(1, 'At least one event type is required'),
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
  const [staffList, setStaffList] = useState<Array<{ id: string; first_name: string; last_name: string }>>([]);
  const [activeTab, setActiveTab] = useState<string>('details');

  const form = useForm({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: {
      name: '',
      description: '',
      entity_type: 'tasks',
      event_types: ['CREATED'],
      enabled: true,
      priority: 0,
      conditions: null as AutomationCondition | null,
    },
  });

  // Load staff list
  useEffect(() => {
    if (isOpen) {
      staffApi.listMinimal({ limit: 100, orderBy: 'first_name', ascending: true })
        .then((result) => {
          setStaffList(result.staff.map(s => ({
            id: s.id,
            first_name: s.first_name,
            last_name: s.last_name,
          })));
        })
        .catch(console.error);
    }
  }, [isOpen]);

  // Initialize form when editing
  useEffect(() => {
    if (isOpen && existingRule) {
      form.reset({
        name: existingRule.name,
        description: existingRule.description || '',
        entity_type: existingRule.entity_type as ActivityEntityType,
        event_types: existingRule.event_types as ActivityEventType[],
        enabled: existingRule.enabled ?? true,
        priority: existingRule.priority ?? 0,
        conditions: (existingRule.conditions as AutomationCondition | null) || null,
      });
      setActiveTab('details');
    }
  }, [isOpen, existingRule, form]);

  const selectedEventTypes = form.watch('event_types');

  const onSubmit = async (data: z.infer<typeof ruleFormSchema>) => {
    try {
      await updateMutation.mutateAsync({
        id: rule.id,
        updates: {
          name: data.name,
          description: data.description || null,
          entity_type: data.entity_type,
          event_types: data.event_types,
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
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-full md:max-w-4xl h-[90vh] flex flex-col p-0 [&>button]:hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full min-h-0">
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
                </div>
              </div>
            </DialogHeader>
            <div className="px-6 pb-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="trigger">Trigger</TabsTrigger>
                <TabsTrigger value="actions">Actions</TabsTrigger>
              </TabsList>
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
                    <TabsContent value="details" className="space-y-6 mt-0">
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
                    </TabsContent>

                    {/* Trigger Tab */}
                    <TabsContent value="trigger" className="space-y-6 mt-0">
                      <div className="space-y-4">
                        <div className="text-sm text-muted-foreground mb-4">
                          Configure when this automation rule should trigger
                        </div>
                        
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

                          {(selectedEventTypes[0] === 'CREATED' || selectedEventTypes[0] === 'UPDATED') && (
                            <FormField
                              control={form.control}
                              name="conditions"
                              render={({ field }) => (
                                <FormItem className="contents">
                                  <FormControl>
                                    <div className="flex flex-wrap items-center gap-2">
                                      {field.value ? (
                                        <>
                                          <span>with</span>
                                          <span className="px-2 py-1 border rounded-md bg-muted/50 text-sm font-medium">
                                            {field.value.field}
                                          </span>
                                          {field.value.operator === 'field_changed' ? (
                                            <span className="text-sm">changed</span>
                                          ) : field.value.operator === 'changed_from' ? (
                                            <>
                                              <span className="text-sm">changed from</span>
                                              <span className="px-2 py-1 border rounded-md bg-muted/50 text-sm">
                                                {String(field.value.value)}
                                              </span>
                                            </>
                                          ) : field.value.operator === 'changed_to' ? (
                                            <>
                                              <span className="text-sm">changed to</span>
                                              <span className="px-2 py-1 border rounded-md bg-muted/50 text-sm">
                                                {String(field.value.value)}
                                              </span>
                                            </>
                                          ) : field.value.operator === 'changed_from_to' ? (
                                            <>
                                              <span className="text-sm">changed from</span>
                                              <span className="px-2 py-1 border rounded-md bg-muted/50 text-sm">
                                                {String(field.value.old_value)}
                                              </span>
                                              <span className="text-sm">to</span>
                                              <span className="px-2 py-1 border rounded-md bg-muted/50 text-sm">
                                                {String(field.value.new_value)}
                                              </span>
                                            </>
                                          ) : (
                                            <>
                                              <span className="text-sm">
                                                {field.value.operator === 'equals' ? 'equals' :
                                                 field.value.operator === 'not_equals' ? 'not equals' :
                                                 field.value.operator === 'contains' ? 'contains' :
                                                 field.value.operator === 'not_contains' ? 'not contains' :
                                                 field.value.operator === 'greater_than' ? 'greater than' :
                                                 field.value.operator === 'less_than' ? 'less than' :
                                                 field.value.operator}
                                              </span>
                                              <span className="px-2 py-1 border rounded-md bg-muted/50 text-sm">
                                                {String(field.value.value)}
                                              </span>
                                            </>
                                          )}
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0"
                                            onClick={() => field.onChange(null)}
                                          >
                                            <X className="h-3 w-3" />
                                          </Button>
                                        </>
                                      ) : (
                                        <AutomationConditionsBuilder
                                          conditions={field.value}
                                          eventTypes={selectedEventTypes as ActivityEventType[]}
                                          entityType={form.watch('entity_type')}
                                          onChange={(condition) => {
                                            field.onChange(condition);
                                          }}
                                          inline={true}
                                        />
                                      )}
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                        </div>
                      </div>
                    </TabsContent>

                    {/* Actions Tab */}
                    <TabsContent value="actions" className="space-y-6 mt-0">
                      <div>
                        {rule.id && (
                          <AutomationActionsList
                            ruleId={rule.id}
                            templates={templates || []}
                            staffList={staffList}
                          />
                        )}
                      </div>
                    </TabsContent>
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
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
