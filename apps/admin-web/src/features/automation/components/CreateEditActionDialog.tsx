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
import { Loader2 } from 'lucide-react';
import { useCreateAutomationAction, useUpdateAutomationAction } from '../api/mutations';
import { useAvailableSenders, type Sender } from '@/features/messages/api/queries';
import type { Tables } from '@altitutor/shared';
import type { AutomationAction, ActionType } from '../types';

const actionFormSchema = z.object({
  action_type: z.enum(['SEND_MESSAGE', 'CREATE_TASK', 'CREATE_NOTIFICATION']),
  order_index: z.number().int().min(0),
  // SEND_MESSAGE config
  template_id: z.string().optional(),
  target_contact_id: z.string().optional(),
  selected_sender_id: z.string().optional(),
  // CREATE_TASK config
  title_template: z.string().optional(),
  description_template: z.string().optional(),
  assigned_to: z.string().optional(),
  priority: z.number().int().min(0).max(4).optional(),
  due_date_offset_days: z.number().int().optional(),
  estimate: z.number().int().positive().optional(),
  status: z.enum(['backlog', 'todo', 'in_progress', 'in_review', 'done']).optional(),
  // CREATE_NOTIFICATION config
  notification_type: z.string().optional(),
  notification_title: z.string().optional(),
  notification_body: z.string().optional(),
  action_url: z.string().optional(),
  target_staff_id: z.string().optional(),
}).refine((data) => {
  if (data.action_type === 'SEND_MESSAGE') {
    return !!data.template_id && !!data.selected_sender_id;
  }
  if (data.action_type === 'CREATE_TASK') {
    return !!data.title_template;
  }
  if (data.action_type === 'CREATE_NOTIFICATION') {
    return !!data.notification_title && !!data.target_staff_id;
  }
  return true;
}, {
  message: 'Please fill in all required fields for the selected action type',
});

type ActionFormData = z.infer<typeof actionFormSchema>;

interface CreateEditActionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  ruleId: string;
  action?: AutomationAction | null;
  templates: Tables<'message_templates'>[];
  staffList: Array<{ id: string; first_name: string; last_name: string }>;
}

export function CreateEditActionDialog({
  isOpen,
  onClose,
  ruleId,
  action,
  templates,
  staffList,
}: CreateEditActionDialogProps) {
  const isEditing = !!action;
  const createMutation = useCreateAutomationAction();
  const updateMutation = useUpdateAutomationAction();
  const { data: availableSenders, isLoading: isLoadingSenders } = useAvailableSenders();

  const form = useForm({
    resolver: zodResolver(actionFormSchema),
    defaultValues: {
      action_type: 'CREATE_TASK' as const,
      order_index: 0,
      template_id: '',
      target_contact_id: '',
      selected_sender_id: '',
      title_template: '',
      description_template: '',
      assigned_to: '',
      priority: 0,
      notification_type: '',
      notification_title: '',
      notification_body: '',
      action_url: '',
      target_staff_id: '',
    },
  });

  const actionType = form.watch('action_type');

  // Initialize form when editing
  useEffect(() => {
    if (isOpen && isEditing && action) {
      const config = action.action_config as any;
      form.reset({
        action_type: action.action_type as ActionType,
        order_index: action.order_index || 0,
        template_id: config.template_id,
        target_contact_id: config.target_contact_id || config.contact_id,
        // Handle both old field name (selected_sender_id) and new field name (owned_number_id) for backward compatibility
        selected_sender_id: config.owned_number_id || config.selected_sender_id,
        title_template: config.title_template,
        description_template: config.description_template,
        assigned_to: config.assigned_to,
        priority: config.priority,
        due_date_offset_days: config.due_date_offset_days,
        estimate: config.estimate,
        status: config.status,
        notification_type: config.notification_type,
        notification_title: config.title,
        notification_body: config.body,
        action_url: config.action_url,
        target_staff_id: config.target_staff_id,
      });
    } else if (isOpen && !isEditing) {
      form.reset({
        action_type: 'CREATE_TASK',
        order_index: 0,
      });
    }
  }, [isOpen, isEditing, action, form]);

  const onSubmit = async (data: z.infer<typeof actionFormSchema>) => {
    try {
      let actionConfig: any = {};

      if (data.action_type === 'SEND_MESSAGE') {
        actionConfig = {
          template_id: data.template_id,
          owned_number_id: data.selected_sender_id,
          // Only include contact_id if a value is provided (for dynamic behavior, leave it undefined)
          ...(data.target_contact_id && data.target_contact_id.trim() ? { contact_id: data.target_contact_id } : {}),
        };
      } else if (data.action_type === 'CREATE_TASK') {
        actionConfig = {
          title_template: data.title_template,
          description_template: data.description_template,
          assigned_to: data.assigned_to || null,
          priority: data.priority ?? 0,
          due_date_offset_days: data.due_date_offset_days || null,
          estimate: data.estimate || null,
          status: data.status || 'todo',
        };
      } else if (data.action_type === 'CREATE_NOTIFICATION') {
        actionConfig = {
          notification_type: data.notification_type || 'GENERIC',
          title: data.notification_title,
          body: data.notification_body || null,
          action_url: data.action_url || null,
          target_staff_id: data.target_staff_id,
        };
      }

      if (isEditing && action) {
        await updateMutation.mutateAsync({
          id: action.id,
          updates: {
            action_type: data.action_type,
            action_config: actionConfig,
            order_index: data.order_index,
          },
        });
      } else {
        await createMutation.mutateAsync({
          rule_id: ruleId,
          action_type: data.action_type,
          action_config: actionConfig,
          order_index: data.order_index,
        });
      }
      // Close on success (if we reach here, no error was thrown)
      onClose();
    } catch (error) {
      // Error handling is done in mutations
      // Don't close dialog on error
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="w-full md:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Action' : 'Create Action'}</DialogTitle>
          <DialogDescription>
            Configure an action to execute when the rule matches an activity event
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="action_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Action Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="CREATE_TASK">Create Task</SelectItem>
                      <SelectItem value="SEND_MESSAGE">Send Message</SelectItem>
                      <SelectItem value="CREATE_NOTIFICATION">Create Notification</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="order_index"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Order</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormDescription>Actions execute in order (0 = first)</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {actionType === 'CREATE_TASK' && (
              <>
                <FormField
                  control={form.control}
                  name="title_template"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title Template *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Review task #123" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormDescription>Use template variables like {'{{entity_type}}'} for dynamic values</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description_template"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description Template</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Optional description..."
                          {...field}
                          value={field.value || ''}
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="assigned_to"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assign To</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(value || undefined)}
                          value={field.value || undefined}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Unassigned" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {staffList.map((staff) => (
                              <SelectItem key={staff.id} value={staff.id}>
                                {staff.first_name} {staff.last_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>Leave unselected to create an unassigned task</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            max={4}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            value={field.value ?? 0}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="due_date_offset_days"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Date (days from event)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="estimate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estimate</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Initial Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || 'todo'}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="backlog">Backlog</SelectItem>
                          <SelectItem value="todo">Todo</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="in_review">In Review</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {actionType === 'SEND_MESSAGE' && (
              <>
                <FormField
                  control={form.control}
                  name="template_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Message Template *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a template" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {templates.map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="selected_sender_id"
                  render={({ field }) => {
                    const getSenderDisplayName = (sender: Sender | undefined): string => {
                      if (!sender) return 'Select sender';
                      if (sender.sender_type === 'ALPHANUMERIC') {
                        return sender.alphanumeric_sender_id || sender.label || 'Unknown';
                      }
                      return sender.label || sender.phone_e164 || 'Unknown';
                    };

                    return (
                      <FormItem>
                        <FormLabel>Sender *</FormLabel>
                        {isLoadingSenders ? (
                          <FormControl>
                            <Input placeholder="Loading senders..." disabled />
                          </FormControl>
                        ) : (
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || undefined}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a sender" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availableSenders?.map((sender) => (
                                <SelectItem key={sender.id} value={sender.id}>
                                  {getSenderDisplayName(sender)}
                                  {sender.is_default && ' (Default)'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <FormDescription>Select the owned number to send messages from</FormDescription>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                <FormField
                  control={form.control}
                  name="target_contact_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Contact ID (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Leave empty to use student from activity event"
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormDescription>
                        If left empty, the message will be sent to the student associated with the activity event (e.g., when student status changes from trial to active, it will message that student). Only specify a contact ID if you want to send to a specific contact regardless of the trigger.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {actionType === 'CREATE_NOTIFICATION' && (
              <>
                <FormField
                  control={form.control}
                  name="notification_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notification Type</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., TAG, CLASS_CHANGED" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notification_title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title *</FormLabel>
                      <FormControl>
                        <Input placeholder="Notification title" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notification_body"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Body</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Notification body text..."
                          {...field}
                          rows={3}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="target_staff_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Staff *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select staff member" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {staffList.map((staff) => (
                            <SelectItem key={staff.id} value={staff.id}>
                              {staff.first_name} {staff.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="action_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Action URL</FormLabel>
                      <FormControl>
                        <Input placeholder="/tasks/123" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormDescription>URL to navigate to when notification is clicked</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Update Action' : 'Create Action'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

