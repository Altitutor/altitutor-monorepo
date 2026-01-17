'use client';

import React, { useState, useEffect } from 'react';
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
import type { AutomationAction, ActionType, ActivityEntityType } from '../types';
import { TemplateVariablesPicker } from './TemplateVariablesPicker';

// Entity types that have class_id available in activity events
const ENTITY_TYPES_WITH_CLASS_ID: ActivityEntityType[] = [
  'classes',
  'classes_staff',
  'classes_students',
  'sessions', // Sessions have class_id
];

// Entity types that have session_id available in activity events
const ENTITY_TYPES_WITH_SESSION_ID: ActivityEntityType[] = [
  'sessions',
  'sessions_students',
  'sessions_staff',
  'sessions_files',
  'tutor_logs',
  'tutor_logs_staff_attendance',
  'tutor_logs_student_attendance',
  'tutor_logs_topics',
  'tutor_logs_topics_files',
  'tutor_logs_topics_files_students',
  'tutor_logs_topics_students',
];

const actionFormSchema = z.object({
  action_type: z.enum(['SEND_MESSAGE', 'CREATE_TASK', 'CREATE_NOTIFICATION']),
  order_index: z.number().int().min(0),
  // SEND_MESSAGE config
  template_id: z.string().optional(),
  target_contact_id: z.string().optional(),
  selected_sender_id: z.string().optional(),
  message_recipient_type: z.enum(['single', 'class_students', 'class_students_and_parents', 'session_students', 'session_students_and_parents']).optional(),
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
  notification_recipient_type: z.enum(['single', 'class_students', 'class_staff', 'class_all', 'session_students', 'session_staff', 'session_all']).optional(),
}).refine((data) => {
  if (data.action_type === 'SEND_MESSAGE') {
    return !!data.template_id && !!data.selected_sender_id;
  }
  if (data.action_type === 'CREATE_TASK') {
    return !!data.title_template;
  }
  if (data.action_type === 'CREATE_NOTIFICATION') {
    const recipientType = data.notification_recipient_type || 'single';
    if (recipientType === 'single') {
      return !!data.notification_title && !!data.target_staff_id;
    } else {
      return !!data.notification_title; // Bulk recipients don't need target_staff_id
    }
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
  entityType?: ActivityEntityType;
  action?: AutomationAction | null;
  templates: Tables<'message_templates'>[];
  staffList: Array<{ id: string; first_name: string; last_name: string }>;
}

export function CreateEditActionDialog({
  isOpen,
  onClose,
  ruleId,
  entityType,
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
      message_recipient_type: 'single' as const,
      title_template: '',
      description_template: '',
      assigned_to: '',
      priority: 0,
      notification_type: '',
      notification_title: '',
      notification_body: '',
      action_url: '',
      target_staff_id: '',
      notification_recipient_type: 'single' as const,
    },
  });

  const actionType = form.watch('action_type');
  const notificationRecipientType = form.watch('notification_recipient_type');
  const messageRecipientType = form.watch('message_recipient_type');

  // Determine which recipient types are available based on entity type
  const hasClassId = entityType ? ENTITY_TYPES_WITH_CLASS_ID.includes(entityType) : false;
  const hasSessionId = entityType ? ENTITY_TYPES_WITH_SESSION_ID.includes(entityType) : false;

  // Refs for text inputs/textareas to handle cursor position
  const titleInputRef = React.useRef<HTMLInputElement | null>(null);
  const descriptionTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const notificationTitleInputRef = React.useRef<HTMLInputElement | null>(null);
  const notificationBodyTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  // Helper function to insert variable at cursor position
  const insertVariable = (
    field: any,
    ref: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
    variable: string
  ) => {
    const element = ref.current;
    if (!element) {
      // Fallback: just append to end
      const currentValue = field.value || '';
      field.onChange(currentValue + variable);
      return;
    }

    const start = element.selectionStart || 0;
    const end = element.selectionEnd || 0;
    const currentValue = field.value || '';
    const newValue = currentValue.slice(0, start) + variable + currentValue.slice(end);
    
    field.onChange(newValue);
    
    // Restore cursor position after React updates
    setTimeout(() => {
      if (ref.current) {
        ref.current.focus();
        const newCursorPos = start + variable.length;
        ref.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  // Initialize form when editing
  useEffect(() => {
    if (isOpen && isEditing && action) {
      const config = action.action_config as any;
      
      // Determine recipient types from config and validate against entity type
      let notificationRecipientType: 'single' | 'class_students' | 'class_staff' | 'class_all' | 'session_students' | 'session_staff' | 'session_all' = 'single';
      if (action.action_type === 'CREATE_NOTIFICATION' && config.recipients?.type) {
        const recipientType = config.recipients.type as any;
        const isClassType = recipientType.startsWith('class_');
        const isSessionType = recipientType.startsWith('session_');
        
        // Validate recipient type against entity type
        if (recipientType === 'single' || 
            (isClassType && hasClassId) || 
            (isSessionType && hasSessionId)) {
          notificationRecipientType = recipientType;
        } else {
          // Invalid recipient type, fall back to single
          notificationRecipientType = 'single';
        }
      }
      
      let messageRecipientType: 'single' | 'class_students' | 'class_students_and_parents' | 'session_students' | 'session_students_and_parents' = 'single';
      if (action.action_type === 'SEND_MESSAGE' && config.recipients?.type) {
        const recipientType = config.recipients.type as any;
        const isClassType = recipientType.startsWith('class_');
        const isSessionType = recipientType.startsWith('session_');
        
        // Validate recipient type against entity type
        if (recipientType === 'single' || 
            (isClassType && hasClassId) || 
            (isSessionType && hasSessionId)) {
          messageRecipientType = recipientType;
        } else {
          // Invalid recipient type, fall back to single
          messageRecipientType = 'single';
        }
      }
      
      form.reset({
        action_type: action.action_type as ActionType,
        order_index: action.order_index || 0,
        template_id: config.template_id,
        target_contact_id: config.target_contact_id || config.contact_id,
        // Handle both old field name (selected_sender_id) and new field name (owned_number_id) for backward compatibility
        selected_sender_id: config.owned_number_id || config.selected_sender_id,
        message_recipient_type: messageRecipientType,
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
        target_staff_id: config.staff_id || config.target_staff_id, // Support both field names
        notification_recipient_type: notificationRecipientType,
      });
    } else if (isOpen && !isEditing) {
      form.reset({
        action_type: 'CREATE_TASK',
        order_index: 0,
        message_recipient_type: 'single',
        notification_recipient_type: 'single',
      });
    }
  }, [isOpen, isEditing, action, form, hasClassId, hasSessionId]);

  // Reset recipient types if they're invalid for the current entity type
  useEffect(() => {
    if (!entityType) return;

    const currentNotificationType = form.getValues('notification_recipient_type');
    const currentMessageType = form.getValues('message_recipient_type');

    // Check notification recipient type
    if (currentNotificationType && currentNotificationType !== 'single') {
      const isClassType = currentNotificationType.startsWith('class_');
      const isSessionType = currentNotificationType.startsWith('session_');
      
      if ((isClassType && !hasClassId) || (isSessionType && !hasSessionId)) {
        form.setValue('notification_recipient_type', 'single');
      }
    }

    // Check message recipient type
    if (currentMessageType && currentMessageType !== 'single') {
      const isClassType = currentMessageType.startsWith('class_');
      const isSessionType = currentMessageType.startsWith('session_');
      
      if ((isClassType && !hasClassId) || (isSessionType && !hasSessionId)) {
        form.setValue('message_recipient_type', 'single');
      }
    }
  }, [entityType, hasClassId, hasSessionId, form]);

  const onSubmit = async (data: z.infer<typeof actionFormSchema>) => {
    try {
      let actionConfig: any = {};

      if (data.action_type === 'SEND_MESSAGE') {
        const recipientType = data.message_recipient_type || 'single';
        actionConfig = {
          template_id: data.template_id,
          owned_number_id: data.selected_sender_id,
        };
        
        if (recipientType === 'single') {
          // Backward compatible: use contact_id if provided
          if (data.target_contact_id && data.target_contact_id.trim()) {
            actionConfig.contact_id = data.target_contact_id;
          }
          // Otherwise, leave it undefined to use activity event context
        } else {
          // New: use recipients object for bulk operations
          actionConfig.recipients = { type: recipientType };
        }
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
        const recipientType = data.notification_recipient_type || 'single';
        actionConfig = {
          notification_type: data.notification_type || 'GENERIC',
          title: data.notification_title,
          body: data.notification_body || null,
          action_url: data.action_url || null,
        };
        
        if (recipientType === 'single') {
          // Backward compatible: use staff_id
          actionConfig.staff_id = data.target_staff_id;
        } else {
          // New: use recipients object for bulk operations
          actionConfig.recipients = { type: recipientType };
        }
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
                      <div className="flex items-center justify-between">
                        <FormLabel>Title Template *</FormLabel>
                        <TemplateVariablesPicker
                          entityType={entityType}
                          hasClassId={hasClassId}
                          hasSessionId={hasSessionId}
                          onInsert={(variable) => insertVariable(field, titleInputRef, variable)}
                        />
                      </div>
                      <FormControl>
                        <Input 
                          {...field} 
                          ref={(e) => {
                            field.ref(e);
                            titleInputRef.current = e;
                          }}
                          placeholder="e.g., Review task #123" 
                          value={field.value || ''} 
                        />
                      </FormControl>
                      <FormDescription>Use template variables like {'{entity_type}'} for dynamic values</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description_template"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Description Template</FormLabel>
                        <TemplateVariablesPicker
                          entityType={entityType}
                          hasClassId={hasClassId}
                          hasSessionId={hasSessionId}
                          onInsert={(variable) => insertVariable(field, descriptionTextareaRef, variable)}
                        />
                      </div>
                      <FormControl>
                        <Textarea
                          {...field}
                          ref={(e) => {
                            field.ref(e);
                            descriptionTextareaRef.current = e;
                          }}
                          placeholder="Optional description..."
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
                  name="message_recipient_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recipient Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || 'single'}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="single">Single Contact</SelectItem>
                          {hasClassId && (
                            <>
                              <SelectItem value="class_students">All Students in Class</SelectItem>
                              <SelectItem value="class_students_and_parents">All Students & Parents in Class</SelectItem>
                            </>
                          )}
                          {hasSessionId && (
                            <>
                              <SelectItem value="session_students">All Students in Session</SelectItem>
                              <SelectItem value="session_students_and_parents">All Students & Parents in Session</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {!hasClassId && !hasSessionId
                          ? 'Only single recipient is available. Bulk options require the rule to trigger on classes, sessions, or related entities.'
                          : 'Choose who receives this message. Bulk options are available based on the rule\'s entity type.'}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {messageRecipientType === 'single' && (
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
                )}
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
                      <div className="flex items-center justify-between">
                        <FormLabel>Title *</FormLabel>
                        <TemplateVariablesPicker
                          entityType={entityType}
                          hasClassId={hasClassId}
                          hasSessionId={hasSessionId}
                          onInsert={(variable) => insertVariable(field, notificationTitleInputRef, variable)}
                        />
                      </div>
                      <FormControl>
                        <Input 
                          {...field}
                          ref={(e) => {
                            field.ref(e);
                            notificationTitleInputRef.current = e;
                          }}
                          placeholder="Notification title" 
                          value={field.value || ''} 
                        />
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
                      <div className="flex items-center justify-between">
                        <FormLabel>Body</FormLabel>
                        <TemplateVariablesPicker
                          entityType={entityType}
                          hasClassId={hasClassId}
                          hasSessionId={hasSessionId}
                          onInsert={(variable) => insertVariable(field, notificationBodyTextareaRef, variable)}
                        />
                      </div>
                      <FormControl>
                        <Textarea
                          {...field}
                          ref={(e) => {
                            field.ref(e);
                            notificationBodyTextareaRef.current = e;
                          }}
                          placeholder="Notification body text..."
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
                  name="notification_recipient_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recipient Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || 'single'}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="single">Single Staff Member</SelectItem>
                          {hasClassId && (
                            <>
                              <SelectItem value="class_students">All Students in Class</SelectItem>
                              <SelectItem value="class_staff">All Staff in Class</SelectItem>
                              <SelectItem value="class_all">All Students & Staff in Class</SelectItem>
                            </>
                          )}
                          {hasSessionId && (
                            <>
                              <SelectItem value="session_students">All Students in Session</SelectItem>
                              <SelectItem value="session_staff">All Staff in Session</SelectItem>
                              <SelectItem value="session_all">All Students & Staff in Session</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {!hasClassId && !hasSessionId
                          ? 'Only single recipient is available. Bulk options require the rule to trigger on classes, sessions, or related entities.'
                          : 'Choose who receives this notification. Bulk options are available based on the rule\'s entity type.'}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {notificationRecipientType === 'single' && (
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
                )}

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

