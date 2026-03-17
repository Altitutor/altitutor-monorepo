'use client';

import React, { useEffect, useState } from 'react';
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
import { SearchableSelect } from '@altitutor/ui';
import { Loader2 } from 'lucide-react';
import { useCreateAutomationAction, useUpdateAutomationAction } from '../api/mutations';
import { useAvailableSenders, type Sender } from '@/features/messages/api/queries';
import type { ActionConfig, SendMessageActionConfig, CreateTaskActionConfig, CreateNotificationActionConfig } from '../types';
import type { Tables } from '@altitutor/shared';
import type { AutomationAction, ActionType, ActivityEntityType } from '../types';
import { TemplateVariablesPicker } from './TemplateVariablesPicker';
import { MessageTemplatesPicker } from '@/features/messages/components/MessageTemplatesPicker';
import {
  ExpandButton,
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
} from '@/shared/components/expandable-dialog';
import { cn } from '@/shared/utils';

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

// Entity types that have student_id available in activity events
const ENTITY_TYPES_WITH_STUDENT_ID: ActivityEntityType[] = [
  'students',
  'sessions_students',
  'tutor_logs_student_attendance',
  'classes_students',
  'parents_students',
];

// Entity types that are tutor_logs (can use tutor_log recipient types)
const ENTITY_TYPES_TUTOR_LOGS: ActivityEntityType[] = [
  'tutor_logs',
  'tutor_logs_staff_attendance',
  'tutor_logs_student_attendance',
  'tutor_logs_topics',
  'tutor_logs_topics_files',
  'tutor_logs_topics_files_students',
  'tutor_logs_topics_students',
];

const ACTION_TYPE_ITEMS: { id: string; label: string }[] = [
  { id: 'CREATE_TASK', label: 'Create Task' },
  { id: 'SEND_MESSAGE', label: 'Send Message' },
  { id: 'CREATE_NOTIFICATION', label: 'Create Notification' },
];

const STATUS_ITEMS: { id: string; label: string }[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'todo', label: 'Todo' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'in_review', label: 'In Review' },
  { id: 'done', label: 'Done' },
];

function getSenderDisplayName(sender: Sender | undefined): string {
  if (!sender) return 'Select sender';
  if (sender.sender_type === 'ALPHANUMERIC') {
    return sender.alphanumeric_sender_id || sender.label || 'Unknown';
  }
  return sender.label || sender.phone_e164 || 'Unknown';
}

const actionFormSchema = z.object({
  action_type: z.enum(['SEND_MESSAGE', 'CREATE_TASK', 'CREATE_NOTIFICATION']),
  order_index: z.number().int().min(0),
  // SEND_MESSAGE config
  message_content: z.string().optional(),
  target_contact_id: z.string().optional(),
  selected_sender_id: z.string().optional(),
  message_recipient_type: z.enum(['single', 'class_students', 'class_students_and_parents', 'session_students', 'session_students_and_parents', 'student_and_parents', 'tutor_log_students', 'tutor_log_students_and_parents']).optional(),
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
  notification_recipient_type: z.enum(['single', 'class_students', 'class_staff', 'class_all', 'session_students', 'session_staff', 'session_all', 'all_admin_staff', 'all_staff', 'admin_staff_on_day', 'tutor_log_staff']).optional(),
}).refine((data) => {
  if (data.action_type === 'SEND_MESSAGE') {
    return !!data.message_content && data.message_content.trim().length > 0 && !!data.selected_sender_id;
  }
  if (data.action_type === 'CREATE_TASK') {
    return !!data.title_template;
  }
  if (data.action_type === 'CREATE_NOTIFICATION') {
    const recipientType = data.notification_recipient_type || 'single';
    if (recipientType === 'single') {
      // target_staff_id is optional - if not provided, will use activityEvent.staff_id (assigned_to for tasks)
      return !!data.notification_title;
    } else {
      return !!data.notification_title; // Bulk recipients don't need target_staff_id
    }
  }
  return true;
}, {
  message: 'Please fill in all required fields for the selected action type',
});


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
  templates: _templates,
  staffList,
}: CreateEditActionDialogProps) {
  const isEditing = !!action;
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isOpen) setExpanded(false);
  }, [isOpen]);

  const createMutation = useCreateAutomationAction();
  const updateMutation = useUpdateAutomationAction();
  const { data: availableSenders, isLoading: isLoadingSenders } = useAvailableSenders();

  const form = useForm({
    resolver: zodResolver(actionFormSchema),
    defaultValues: {
      action_type: 'CREATE_TASK' as const,
      order_index: 0,
      message_content: '',
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
  const hasStudentId = entityType ? ENTITY_TYPES_WITH_STUDENT_ID.includes(entityType) : false;
  const isTutorLogEntity = entityType ? ENTITY_TYPES_TUTOR_LOGS.includes(entityType) : false;

  // Refs for text inputs/textareas to handle cursor position
  const titleInputRef = React.useRef<HTMLInputElement | null>(null);
  const descriptionTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const notificationTitleInputRef = React.useRef<HTMLInputElement | null>(null);
  const notificationBodyTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const actionUrlInputRef = React.useRef<HTMLInputElement | null>(null);
  const messageContentTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  // Helper function to insert variable at cursor position
  const insertVariable = (
    field: { value: string | undefined; onChange: (value: string) => void },
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
      if (!action.action_config || typeof action.action_config !== 'object' || Array.isArray(action.action_config)) {
        return;
      }
      const config = action.action_config as unknown as ActionConfig;
      
      // Determine recipient types from config and validate against entity type
      let notificationRecipientType: 'single' | 'class_students' | 'class_staff' | 'class_all' | 'session_students' | 'session_staff' | 'session_all' | 'all_admin_staff' | 'all_staff' | 'admin_staff_on_day' | 'tutor_log_staff' = 'single';
      if (action.action_type === 'CREATE_NOTIFICATION' && 'recipients' in config && config.recipients?.type) {
        const recipientType = config.recipients.type;
        const isClassType = recipientType.startsWith('class_');
        const isSessionType = recipientType.startsWith('session_');
        const isTutorLogType = recipientType === 'tutor_log_staff';
        const isGlobalType = ['all_admin_staff', 'all_staff'].includes(recipientType);
        const isAdminStaffOnDay = recipientType === 'admin_staff_on_day';
        
        // Validate recipient type against entity type - only assign if valid
        if (recipientType === 'single' || 
            (isClassType && hasClassId) || 
            (isSessionType && hasSessionId) ||
            (isTutorLogType && isTutorLogEntity) ||
            isGlobalType ||
            (isAdminStaffOnDay && (hasClassId || hasSessionId))) {
          if (recipientType === 'single' || recipientType === 'class_students' || recipientType === 'class_staff' || recipientType === 'class_all' || recipientType === 'session_students' || recipientType === 'session_staff' || recipientType === 'session_all' || recipientType === 'all_admin_staff' || recipientType === 'all_staff' || recipientType === 'admin_staff_on_day' || recipientType === 'tutor_log_staff') {
            notificationRecipientType = recipientType;
          }
        }
      }
      
      let messageRecipientType: 'single' | 'class_students' | 'class_students_and_parents' | 'session_students' | 'session_students_and_parents' | 'student_and_parents' | 'tutor_log_students' | 'tutor_log_students_and_parents' = 'single';
      if (action.action_type === 'SEND_MESSAGE' && 'recipients' in config && config.recipients?.type) {
        const recipientType = config.recipients.type;
        const isClassType = recipientType.startsWith('class_');
        const isSessionType = recipientType.startsWith('session_');
        const isTutorLogType = recipientType.startsWith('tutor_log_');
        const isStudentType = recipientType === 'student_and_parents';
        
        // Validate recipient type against entity type - only assign if valid
        if (recipientType === 'single' || 
            (isClassType && hasClassId) || 
            (isSessionType && hasSessionId) ||
            (isTutorLogType && isTutorLogEntity) ||
            (isStudentType && hasStudentId)) {
          if (recipientType === 'single' || recipientType === 'class_students' || recipientType === 'class_students_and_parents' || recipientType === 'session_students' || recipientType === 'session_students_and_parents' || recipientType === 'student_and_parents' || recipientType === 'tutor_log_students' || recipientType === 'tutor_log_students_and_parents') {
            messageRecipientType = recipientType;
          }
        }
      }
      
      form.reset({
        action_type: action.action_type as ActionType,
        order_index: action.order_index || 0,
        message_content: action.action_type === 'SEND_MESSAGE' && 'message_content' in config ? config.message_content : undefined,
        target_contact_id: action.action_type === 'SEND_MESSAGE' && ('target_contact_id' in config || 'contact_id' in config) ? ('target_contact_id' in config && typeof config.target_contact_id === 'string' ? config.target_contact_id : ('contact_id' in config && typeof config.contact_id === 'string' ? config.contact_id : undefined)) : undefined,
        // Handle both old field name (selected_sender_id) and new field name (owned_number_id) for backward compatibility
        selected_sender_id: action.action_type === 'SEND_MESSAGE' && ('owned_number_id' in config || 'selected_sender_id' in config) ? ('owned_number_id' in config && typeof config.owned_number_id === 'string' ? config.owned_number_id : ('selected_sender_id' in config && typeof config.selected_sender_id === 'string' ? config.selected_sender_id : undefined)) : undefined,
        message_recipient_type: messageRecipientType,
        title_template: action.action_type === 'CREATE_TASK' && 'title_template' in config ? config.title_template : undefined,
        description_template: action.action_type === 'CREATE_TASK' && 'description_template' in config ? config.description_template : undefined,
        assigned_to: action.action_type === 'CREATE_TASK' && 'assigned_to' in config ? config.assigned_to : undefined,
        priority: action.action_type === 'CREATE_TASK' && 'priority' in config ? config.priority : undefined,
        due_date_offset_days: action.action_type === 'CREATE_TASK' && 'due_date_offset_days' in config ? config.due_date_offset_days : undefined,
        estimate: action.action_type === 'CREATE_TASK' && 'estimate' in config ? config.estimate : undefined,
        status: action.action_type === 'CREATE_TASK' && 'status' in config && typeof config.status === 'string' && ['backlog', 'todo', 'in_progress', 'in_review', 'done'].includes(config.status) ? config.status as 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' : undefined,
        notification_type: action.action_type === 'CREATE_NOTIFICATION' && 'notification_type' in config ? config.notification_type : undefined,
        notification_title: action.action_type === 'CREATE_NOTIFICATION' && 'title' in config ? config.title : undefined,
        notification_body: action.action_type === 'CREATE_NOTIFICATION' && 'body' in config ? config.body : undefined,
        action_url: action.action_type === 'CREATE_NOTIFICATION' && 'action_url' in config ? config.action_url : undefined,
        // If staff_id is not set, use empty string to trigger auto-detect (will display as "__AUTO__")
        target_staff_id: action.action_type === 'CREATE_NOTIFICATION' && ('staff_id' in config || 'target_staff_id' in config) ? ('staff_id' in config && typeof config.staff_id === 'string' ? config.staff_id : ('target_staff_id' in config && typeof config.target_staff_id === 'string' ? config.target_staff_id : '')) : '',
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
  }, [isOpen, isEditing, action, form, hasClassId, hasSessionId, hasStudentId, isTutorLogEntity]);

  // Reset recipient types if they're invalid for the current entity type
  useEffect(() => {
    if (!entityType) return;

    const currentNotificationType = form.getValues('notification_recipient_type');
    const currentMessageType = form.getValues('message_recipient_type');

    // Check notification recipient type
    if (currentNotificationType && currentNotificationType !== 'single') {
      const isClassType = currentNotificationType.startsWith('class_');
      const isSessionType = currentNotificationType.startsWith('session_');
      const isTutorLogType = currentNotificationType === 'tutor_log_staff';
      const isAdminStaffOnDay = currentNotificationType === 'admin_staff_on_day';
      
      // Global types (all_admin_staff, all_staff) are always valid
      // admin_staff_on_day requires class_id or session_id
      // Class/session types require corresponding IDs
      // Tutor log types require tutor log entity
      if ((isClassType && !hasClassId) || 
          (isSessionType && !hasSessionId) ||
          (isTutorLogType && !isTutorLogEntity) ||
          (isAdminStaffOnDay && !hasClassId && !hasSessionId)) {
        form.setValue('notification_recipient_type', 'single');
      }
    }

    // Check message recipient type
    if (currentMessageType && currentMessageType !== 'single') {
      const isClassType = currentMessageType.startsWith('class_');
      const isSessionType = currentMessageType.startsWith('session_');
      const isTutorLogType = currentMessageType.startsWith('tutor_log_');
      const isStudentType = currentMessageType === 'student_and_parents';
      
      if ((isClassType && !hasClassId) || 
          (isSessionType && !hasSessionId) ||
          (isTutorLogType && !isTutorLogEntity) ||
          (isStudentType && !hasStudentId)) {
        form.setValue('message_recipient_type', 'single');
      }
    }
  }, [entityType, hasClassId, hasSessionId, hasStudentId, isTutorLogEntity, form]);

  const onSubmit = async (data: z.infer<typeof actionFormSchema>) => {
    try {
      let actionConfig: ActionConfig;

      if (data.action_type === 'SEND_MESSAGE') {
        if (!data.message_content || !data.message_content.trim()) {
          throw new Error('Message content is required for SEND_MESSAGE action');
        }
        const recipientType = data.message_recipient_type || 'single';
        const sendMessageConfig: SendMessageActionConfig = {
          message_content: data.message_content,
          owned_number_id: data.selected_sender_id,
          ...(recipientType === 'single' && data.target_contact_id && data.target_contact_id.trim()
            ? { contact_id: data.target_contact_id }
            : {}),
          ...(recipientType !== 'single' ? { recipients: { type: recipientType } } : {}),
        };
        actionConfig = sendMessageConfig;
      } else if (data.action_type === 'CREATE_TASK') {
        if (!data.title_template) {
          throw new Error('Title template is required for CREATE_TASK action');
        }
        const createTaskConfig: CreateTaskActionConfig = {
          title_template: data.title_template,
          description_template: data.description_template || undefined,
          assigned_to: data.assigned_to || undefined,
          priority: data.priority ?? 0,
          due_date_offset_days: data.due_date_offset_days || undefined,
          estimate: data.estimate || undefined,
        };
        actionConfig = createTaskConfig;
      } else if (data.action_type === 'CREATE_NOTIFICATION') {
        if (!data.notification_title) {
          throw new Error('Title is required for CREATE_NOTIFICATION action');
        }
        const recipientType = data.notification_recipient_type || 'single';
        const createNotificationConfig: CreateNotificationActionConfig = {
          notification_type: data.notification_type || 'GENERIC',
          title: data.notification_title,
          body: data.notification_body || undefined,
          action_url: data.action_url || undefined,
          ...(recipientType === 'single' && data.target_staff_id ? { staff_id: data.target_staff_id } : {}),
          ...(recipientType !== 'single' ? { recipients: { type: recipientType } } : {}),
        };
        actionConfig = createNotificationConfig;
      } else {
        throw new Error(`Unknown action type: ${data.action_type}`);
      }

      // Convert ActionConfig to Json type for database storage
      type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
      const actionConfigJson = JSON.parse(JSON.stringify(actionConfig)) as Json;
      
      if (isEditing && action) {
        await updateMutation.mutateAsync({
          id: action.id,
          updates: {
            action_type: data.action_type,
            action_config: actionConfigJson,
            order_index: data.order_index,
          },
        });
      } else {
        await createMutation.mutateAsync({
          rule_id: ruleId,
          action_type: data.action_type,
          action_config: actionConfigJson,
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
      <DialogContent
        className={cn(
          'w-full md:max-w-2xl max-h-[90vh] overflow-y-auto',
          EXPANDABLE_DIALOG_TRANSITION,
          expanded && EXPANDED_DIALOG_CONTENT_CLASS
        )}
      >
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle>{isEditing ? 'Edit Action' : 'Create Action'}</DialogTitle>
              <DialogDescription>
                Configure an action to execute when the rule matches an activity event
              </DialogDescription>
            </div>
            <ExpandButton expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="action_type"
              render={({ field }) => {
                const selected = ACTION_TYPE_ITEMS.find((i) => i.id === field.value) ?? null;
                return (
                  <FormItem>
                    <FormLabel>Action Type</FormLabel>
                    <FormControl>
                      <SearchableSelect<{ id: string; label: string }>
                        items={ACTION_TYPE_ITEMS}
                        value={selected}
                        onValueChange={(item) => field.onChange(item?.id ?? 'CREATE_TASK')}
                        getItemId={(i) => i.id}
                        getItemLabel={(i) => i.label}
                        placeholder="Select action type"
                        trigger={
                          <Button variant="outline" className="w-full justify-start font-normal">
                            <span className={cn(!selected && 'text-muted-foreground')}>
                              {selected ? selected.label : 'Select action type'}
                            </span>
                          </Button>
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
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
                          onInsert={(variable) => insertVariable({ value: field.value || '', onChange: field.onChange }, titleInputRef, variable)}
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
                          onInsert={(variable) => insertVariable({ value: field.value || '', onChange: field.onChange }, descriptionTextareaRef, variable)}
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
                    render={({ field }) => {
                      const selected = field.value
                        ? staffList.find((s) => s.id === field.value) ?? null
                        : null;
                      return (
                        <FormItem>
                          <FormLabel>Assign To</FormLabel>
                          <FormControl>
                            <SearchableSelect<{ id: string; first_name: string; last_name: string }>
                              items={staffList}
                              value={selected}
                              onValueChange={(s) => field.onChange(s?.id ?? undefined)}
                              getItemId={(s) => s.id}
                              getItemLabel={(s) => `${s.first_name} ${s.last_name}`}
                              placeholder="Unassigned"
                              allowClear
                              clearLabel="Unassigned"
                              trigger={
                                <Button variant="outline" className="w-full justify-start font-normal">
                                  <span className={cn(!selected && 'text-muted-foreground')}>
                                    {selected ? `${selected.first_name} ${selected.last_name}` : 'Unassigned'}
                                  </span>
                                </Button>
                              }
                            />
                          </FormControl>
                          <FormDescription>Leave unselected to create an unassigned task</FormDescription>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
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
                  render={({ field }) => {
                    const selected = STATUS_ITEMS.find((i) => i.id === (field.value || 'todo')) ?? STATUS_ITEMS[1];
                    return (
                      <FormItem>
                        <FormLabel>Initial Status</FormLabel>
                        <FormControl>
                          <SearchableSelect<{ id: string; label: string }>
                            items={STATUS_ITEMS}
                            value={selected}
                            onValueChange={(item) => field.onChange(item?.id ?? 'todo')}
                            getItemId={(i) => i.id}
                            getItemLabel={(i) => i.label}
                            placeholder="Todo"
                            trigger={
                              <Button variant="outline" className="w-full justify-start font-normal">
                                <span className={cn(!selected && 'text-muted-foreground')}>
                                  {selected ? selected.label : 'Todo'}
                                </span>
                              </Button>
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </>
            )}

            {actionType === 'SEND_MESSAGE' && (
              <>
                <FormField
                  control={form.control}
                  name="message_content"
                  render={({ field }) => {
                    const handleTemplateSelect = (template: Tables<'message_templates'>) => {
                      const currentValue = field.value || '';
                      const textarea = messageContentTextareaRef.current;
                      
                      if (textarea) {
                        const start = textarea.selectionStart || 0;
                        const end = textarea.selectionEnd || 0;
                        const textBefore = currentValue.substring(0, start);
                        const textAfter = currentValue.substring(end);
                        const newValue = textBefore + template.content + textAfter;
                        field.onChange(newValue);
                        
                        // Restore cursor position after template insertion
                        setTimeout(() => {
                          const newPosition = start + template.content.length;
                          textarea.focus();
                          textarea.setSelectionRange(newPosition, newPosition);
                        }, 0);
                      } else {
                        // Fallback: append to end
                        field.onChange(currentValue + (currentValue ? '\n\n' : '') + template.content);
                      }
                    };
                    
                    return (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>Message Content *</FormLabel>
                          <div className="flex items-center gap-2">
                            <MessageTemplatesPicker 
                              onSelect={handleTemplateSelect}
                              expanded={true}
                            />
                            <TemplateVariablesPicker
                              entityType={entityType}
                              hasClassId={hasClassId}
                              hasSessionId={hasSessionId}
                              onInsert={(variable) => insertVariable({ value: field.value || '', onChange: field.onChange }, messageContentTextareaRef, variable)}
                            />
                          </div>
                        </div>
                        <FormControl>
                          <Textarea
                            {...field}
                            ref={(e) => {
                              field.ref(e);
                              messageContentTextareaRef.current = e;
                            }}
                            placeholder="Type your message here or insert a template..."
                            rows={6}
                            value={field.value || ''}
                            className="font-mono text-sm"
                          />
                        </FormControl>
                        <FormDescription>
                          Compose your message. You can insert templates or variables using the buttons above.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                <FormField
                  control={form.control}
                  name="selected_sender_id"
                  render={({ field }) => {
                    const selected = availableSenders?.find((s) => s.id === field.value) ?? null;
                    const getItemLabel = (s: Sender) =>
                      getSenderDisplayName(s) + (s.is_default ? ' (Default)' : '');
                    return (
                      <FormItem>
                        <FormLabel>Sender *</FormLabel>
                        {isLoadingSenders ? (
                          <FormControl>
                            <Input placeholder="Loading senders..." disabled />
                          </FormControl>
                        ) : (
                          <FormControl>
                            <SearchableSelect<Sender>
                              items={availableSenders ?? []}
                              value={selected}
                              onValueChange={(s) => field.onChange(s?.id ?? '')}
                              getItemId={(s) => s.id}
                              getItemLabel={getItemLabel}
                              placeholder="Select a sender"
                              loading={isLoadingSenders}
                              trigger={
                                <Button variant="outline" className="w-full justify-start font-normal">
                                  <span className={cn(!selected && 'text-muted-foreground')}>
                                    {selected ? getItemLabel(selected) : 'Select a sender'}
                                  </span>
                                </Button>
                              }
                            />
                          </FormControl>
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
                  render={({ field }) => {
                    const messageRecipientOptions: { id: string; label: string }[] = [
                      { id: 'single', label: 'Single Contact' },
                      ...(hasClassId
                        ? [
                            { id: 'class_students', label: 'All Students in Class' },
                            { id: 'class_students_and_parents', label: 'All Students & Parents in Class' },
                          ]
                        : []),
                      ...(hasSessionId
                        ? [
                            { id: 'session_students', label: 'All Students in Session' },
                            { id: 'session_students_and_parents', label: 'All Students & Parents in Session' },
                          ]
                        : []),
                      ...(hasStudentId ? [{ id: 'student_and_parents', label: 'Student & All Parents' }] : []),
                      ...(isTutorLogEntity
                        ? [
                            { id: 'tutor_log_students', label: 'All Students in Tutor Log' },
                            { id: 'tutor_log_students_and_parents', label: 'All Students & Parents in Tutor Log' },
                          ]
                        : []),
                    ];
                    const selected =
                      messageRecipientOptions.find((i) => i.id === (field.value || 'single')) ??
                      messageRecipientOptions[0];
                    return (
                      <FormItem>
                        <FormLabel>Recipient Type</FormLabel>
                        <FormControl>
                          <SearchableSelect<{ id: string; label: string }>
                            items={messageRecipientOptions}
                            value={selected}
                            onValueChange={(item) => field.onChange(item?.id ?? 'single')}
                            getItemId={(i) => i.id}
                            getItemLabel={(i) => i.label}
                            placeholder="Single Contact"
                            trigger={
                              <Button variant="outline" className="w-full justify-start font-normal">
                                <span className={cn(!selected && 'text-muted-foreground')}>
                                  {selected ? selected.label : 'Single Contact'}
                                </span>
                              </Button>
                            }
                          />
                        </FormControl>
                        <FormDescription>
                          {!hasClassId && !hasSessionId && !hasStudentId && !isTutorLogEntity
                            ? 'Only single recipient is available. Bulk options require the rule to trigger on classes, sessions, students, or tutor logs.'
                            : 'Choose who receives this message. Bulk options are available based on the rule\'s entity type.'}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
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
                          onInsert={(variable) => insertVariable({ value: field.value || '', onChange: field.onChange }, notificationTitleInputRef, variable)}
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
                          onInsert={(variable) => insertVariable({ value: field.value || '', onChange: field.onChange }, notificationBodyTextareaRef, variable)}
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
                  render={({ field }) => {
                    const notificationRecipientOptions: { id: string; label: string }[] = [
                      { id: 'single', label: 'Single Staff Member' },
                      { id: 'all_admin_staff', label: 'All Admin Staff' },
                      { id: 'all_staff', label: 'All Staff' },
                      ...(hasClassId
                        ? [
                            { id: 'class_students', label: 'All Students in Class' },
                            { id: 'class_staff', label: 'All Staff in Class' },
                            { id: 'class_all', label: 'All Students & Staff in Class' },
                          ]
                        : []),
                      ...(hasSessionId
                        ? [
                            { id: 'session_students', label: 'All Students in Session' },
                            { id: 'session_staff', label: 'All Staff in Session' },
                            { id: 'session_all', label: 'All Students & Staff in Session' },
                          ]
                        : []),
                      ...(hasClassId || hasSessionId
                        ? [{ id: 'admin_staff_on_day', label: 'Admin Staff on Day' }]
                        : []),
                      ...(isTutorLogEntity ? [{ id: 'tutor_log_staff', label: 'All Staff in Tutor Log' }] : []),
                    ];
                    const selected =
                      notificationRecipientOptions.find((i) => i.id === (field.value || 'single')) ??
                      notificationRecipientOptions[0];
                    return (
                      <FormItem>
                        <FormLabel>Recipient Type</FormLabel>
                        <FormControl>
                          <SearchableSelect<{ id: string; label: string }>
                            items={notificationRecipientOptions}
                            value={selected}
                            onValueChange={(item) => field.onChange(item?.id ?? 'single')}
                            getItemId={(i) => i.id}
                            getItemLabel={(i) => i.label}
                            placeholder="Single Staff Member"
                            trigger={
                              <Button variant="outline" className="w-full justify-start font-normal">
                                <span className={cn(!selected && 'text-muted-foreground')}>
                                  {selected ? selected.label : 'Single Staff Member'}
                                </span>
                              </Button>
                            }
                          />
                        </FormControl>
                        <FormDescription>
                          {!hasClassId && !hasSessionId
                            ? 'Global options (All Admin Staff, All Staff) are always available. Class/session-specific options require the rule to trigger on classes, sessions, or related entities.'
                            : 'Choose who receives this notification. Global options are always available. Class/session-specific options are available based on the rule\'s entity type.'}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                {notificationRecipientType === 'single' && (
                  <FormField
                    control={form.control}
                    name="target_staff_id"
                    render={({ field }) => {
                      const autoLabel =
                        entityType === 'tasks'
                          ? 'Use Assigned Staff Member (from task)'
                          : 'Use Activity Event Staff (auto-detect)';
                      const targetStaffItems: { id: string; label: string }[] = [
                        { id: '__AUTO__', label: autoLabel },
                        ...staffList.map((s) => ({ id: s.id, label: `${s.first_name} ${s.last_name}` })),
                      ];
                      const rawValue = field.value || '__AUTO__';
                      const selected =
                        targetStaffItems.find((i) => i.id === rawValue) ?? targetStaffItems[0];
                      return (
                        <FormItem>
                          <FormLabel>Target Staff</FormLabel>
                          <FormControl>
                            <SearchableSelect<{ id: string; label: string }>
                              items={targetStaffItems}
                              value={selected}
                              onValueChange={(item) =>
                                field.onChange(item?.id === '__AUTO__' ? '' : item?.id ?? '')
                              }
                              getItemId={(i) => i.id}
                              getItemLabel={(i) => i.label}
                              placeholder="Select staff member"
                              trigger={
                                <Button variant="outline" className="w-full justify-start font-normal">
                                  <span className={cn(!selected && 'text-muted-foreground')}>
                                    {selected ? selected.label : 'Select staff member'}
                                  </span>
                                </Button>
                              }
                            />
                          </FormControl>
                          <FormDescription>
                            {entityType === 'tasks'
                              ? 'Select a specific staff member, or choose "Use Assigned Staff Member" to automatically notify whoever the task is assigned to.'
                              : 'Select a specific staff member, or choose "Use Activity Event Staff" to automatically use the staff member from the activity event context.'}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                )}

                <FormField
                  control={form.control}
                  name="action_url"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Action URL</FormLabel>
                        <TemplateVariablesPicker
                          entityType={entityType}
                          hasClassId={hasClassId}
                          hasSessionId={hasSessionId}
                          onInsert={(variable) => insertVariable({ value: field.value || '', onChange: field.onChange }, actionUrlInputRef, variable)}
                        />
                      </div>
                      <FormControl>
                        <Input 
                          placeholder="/tasks/{task_id} or /students/{student_id}" 
                          {...field} 
                          ref={(e) => {
                            field.ref(e);
                            actionUrlInputRef.current = e;
                          }}
                          value={field.value || ''} 
                        />
                      </FormControl>
                      <FormDescription>
                        URL to navigate to when notification is clicked. You can use variables like {'{task_id}'}, {'{student_id}'}, etc.
                      </FormDescription>
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

