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
  DialogFooter,
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
import { Badge } from '@altitutor/ui';
import { ScrollArea } from '@altitutor/ui';
import { Separator } from '@altitutor/ui';
import { Switch } from '@altitutor/ui';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@altitutor/ui';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import { useCreateAutomationRule, useUpdateAutomationRule } from '../api/mutations';
import { useAutomationRule, useAutomationRules } from '../api/queries';
import { useMessageTemplates } from '@/features/messages/api/templates';
import { staffApi } from '@/features/staff/api/staff';
import type { AutomationRuleWithActions, ActionType, ActivityEntityType, ActivityEventType } from '../types';
import { AutomationActionsList } from './AutomationActionsList';
import { AutomationConditionsBuilder } from './AutomationConditionsBuilder';
import { useQueryClient } from '@tanstack/react-query';
import type { AutomationCondition } from '../types';

const ruleFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().default(''),
  entity_type: z.string().min(1, 'Entity type is required'),
  event_types: z.array(z.string()).min(1, 'At least one event type is required'),
  enabled: z.boolean(),
  priority: z.number().int().min(0),
  conditions: z.any().optional().nullable(), // AutomationCondition | null
});

type RuleFormData = z.infer<typeof ruleFormSchema>;

interface CreateEditAutomationRuleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  rule?: AutomationRuleWithActions | null;
}

const ENTITY_TYPES: { value: ActivityEntityType; label: string }[] = [
  { value: 'tasks', label: 'Tasks' },
  { value: 'students', label: 'Students' },
  { value: 'classes', label: 'Classes' },
  { value: 'sessions', label: 'Sessions' },
  { value: 'staff', label: 'Staff' },
  { value: 'parents', label: 'Parents' },
  { value: 'invoices', label: 'Invoices' },
  { value: 'invoice_items', label: 'Invoice Items' },
  { value: 'notes', label: 'Notes' },
  { value: 'tutor_logs', label: 'Tutor Logs' },
];

const EVENT_TYPES: { value: ActivityEventType; label: string }[] = [
  { value: 'CREATED', label: 'Created' },
  { value: 'UPDATED', label: 'Updated' },
  { value: 'DELETED', label: 'Deleted' },
];

export function CreateEditAutomationRuleDialog({
  isOpen,
  onClose,
  rule,
}: CreateEditAutomationRuleDialogProps) {
  const isEditing = !!rule;
  const createMutation = useCreateAutomationRule();
  const updateMutation = useUpdateAutomationRule();
  const queryClient = useQueryClient();
  const { data: existingRule, refetch: refetchRule } = useAutomationRule(rule?.id || '', isEditing && !!rule?.id);
  const { data: templates } = useMessageTemplates();
  const [staffList, setStaffList] = useState<Array<{ id: string; first_name: string; last_name: string }>>([]);
  const [createdRuleId, setCreatedRuleId] = useState<string | null>(null);
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
    if (isOpen && isEditing && existingRule) {
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
    } else if (isOpen && !isEditing && !createdRuleId) {
      form.reset({
        name: '',
        description: '',
        entity_type: 'tasks',
        event_types: ['CREATED'],
        enabled: true,
        priority: 0,
        conditions: null,
      });
      setActiveTab('details');
    }
  }, [isOpen, isEditing, existingRule, form, createdRuleId]);

  // Switch to actions tab after creating a rule
  useEffect(() => {
    if (createdRuleId && !isEditing) {
      setActiveTab('actions');
    }
  }, [createdRuleId, isEditing]);

  const selectedEventTypes = form.watch('event_types');

  const toggleEventType = (eventType: ActivityEventType) => {
    const current = form.getValues('event_types');
    if (current.includes(eventType)) {
      form.setValue('event_types', current.filter((e) => e !== eventType));
    } else {
      form.setValue('event_types', [...current, eventType]);
    }
  };

  const onSubmit = async (data: z.infer<typeof ruleFormSchema>) => {
    try {
      if (isEditing && rule) {
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
        // Don't close - allow editing actions
      } else {
        const newRule = await createMutation.mutateAsync({
          name: data.name,
          description: data.description || null,
          entity_type: data.entity_type,
          event_types: data.event_types,
          enabled: data.enabled,
          priority: data.priority,
          conditions: data.conditions || null,
        });
        setCreatedRuleId(newRule.id);
        // Refresh rules to get the new rule with actions
        await queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      }
    } catch (error) {
      // Error handling is done in mutations
    }
  };

  const handleClose = () => {
    if (createdRuleId) {
      // If we just created a rule, refresh the list
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
    }
    setCreatedRuleId(null);
    form.reset();
    onClose();
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const ruleId = createdRuleId || (isEditing && rule ? rule.id : null);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-full md:max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
          <DialogTitle>{isEditing ? 'Edit Automation Rule' : 'Create Automation Rule'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the automation rule and its actions.'
              : 'Create a new automation rule that triggers actions based on activity events.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="w-full rounded-none border-b border-t-0 mt-0 h-auto">
              <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
              <TabsTrigger value="trigger" className="flex-1">Trigger</TabsTrigger>
              <TabsTrigger value="actions" className="flex-1">Actions</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden min-h-0">
              <ScrollArea className="h-full">
                <div className="p-6">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                        <FormField
                          control={form.control}
                          name="entity_type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Entity Type</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {ENTITY_TYPES.map((type) => (
                                    <SelectItem key={type.value} value={type.value}>
                                      {type.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormDescription>Which entity type to monitor</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="event_types"
                          render={() => (
                            <FormItem>
                              <FormLabel>Event Types</FormLabel>
                              <div className="flex flex-wrap gap-2">
                                {EVENT_TYPES.map((eventType) => (
                                  <Badge
                                    key={eventType.value}
                                    variant={selectedEventTypes.includes(eventType.value) ? 'default' : 'outline'}
                                    className="cursor-pointer"
                                    onClick={() => toggleEventType(eventType.value)}
                                  >
                                    {eventType.label}
                                    {selectedEventTypes.includes(eventType.value) && (
                                      <X className="ml-1 h-3 w-3" />
                                    )}
                                  </Badge>
                                ))}
                              </div>
                              <FormDescription>Select which events trigger this rule</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="conditions"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <AutomationConditionsBuilder
                                  conditions={field.value}
                                  eventTypes={selectedEventTypes as ActivityEventType[]}
                                  entityType={form.watch('entity_type')}
                                  onChange={(condition) => {
                                    field.onChange(condition);
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TabsContent>

                      {/* Actions Tab */}
                      <TabsContent value="actions" className="space-y-6 mt-0">
                        <div>
                          <div className="mb-4">
                            <h3 className="text-lg font-semibold">Actions</h3>
                            <p className="text-sm text-muted-foreground">
                              Actions to execute when this rule matches an activity event
                            </p>
                          </div>

                          {ruleId && (
                            <AutomationActionsList
                              ruleId={ruleId}
                              templates={templates || []}
                              staffList={staffList}
                            />
                          )}
                          {!ruleId && (
                            <div className="text-center py-8 text-muted-foreground border rounded-lg">
                              <p>Save the rule first to add actions</p>
                            </div>
                          )}
                        </div>
                      </TabsContent>
                    </form>
                  </Form>
                </div>
              </ScrollArea>
            </div>
          </Tabs>
        </div>

        <DialogFooter className="flex-shrink-0 px-6 py-4 border-t">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            {ruleId ? 'Close' : 'Cancel'}
          </Button>
          {!ruleId && (
            <Button onClick={form.handleSubmit(onSubmit)} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Update Rule' : 'Create Rule'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

