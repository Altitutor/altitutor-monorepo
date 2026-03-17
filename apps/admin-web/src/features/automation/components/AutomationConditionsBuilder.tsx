'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { SearchableSelect } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import { X, Plus } from 'lucide-react';
import type { AutomationCondition, ConditionOperator, ActivityEventType } from '../types';

const conditionSchema = z.object({
  field: z.string().min(1, 'Field is required'),
  operator: z.string().min(1, 'Operator is required'),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  old_value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  new_value: z.union([z.string(), z.number(), z.boolean()]).optional(),
}).refine((data) => {
  // Validate based on operator type
  if (data.operator === 'field_changed') {
    return true; // No value needed
  }
  if (data.operator === 'changed_from_to') {
    return data.old_value !== undefined && data.new_value !== undefined;
  }
  // All other operators need value
  return data.value !== undefined;
}, {
  message: 'Please fill in all required fields for the selected operator',
});

type ConditionFormData = z.infer<typeof conditionSchema>;

interface AutomationConditionsBuilderProps {
  conditions: AutomationCondition | null;
  eventTypes: ActivityEventType[];
  entityType: string;
  onChange: (condition: AutomationCondition | null) => void;
  inline?: boolean; // If true, render inline instead of as a card
}

// Standard operators (work for CREATED and current state)
const STANDARD_OPERATORS: { value: ConditionOperator; label: string; description: string }[] = [
  { value: 'equals', label: 'Equals', description: 'Field equals a specific value' },
  { value: 'not_equals', label: 'Not Equals', description: 'Field does not equal a value' },
  { value: 'contains', label: 'Contains', description: 'Field contains text' },
  { value: 'not_contains', label: 'Not Contains', description: 'Field does not contain text' },
  { value: 'greater_than', label: 'Greater Than', description: 'Field is greater than a number' },
  { value: 'less_than', label: 'Less Than', description: 'Field is less than a number' },
];

// Field change operators (only work for UPDATED events)
const FIELD_CHANGE_OPERATORS: { value: ConditionOperator; label: string; description: string }[] = [
  { value: 'field_changed', label: 'Field Changed', description: 'Field was changed (any change)' },
  { value: 'changed_from', label: 'Changed From', description: 'Field changed from a specific value' },
  { value: 'changed_to', label: 'Changed To', description: 'Field changed to a specific value' },
  { value: 'changed_from_to', label: 'Changed From → To', description: 'Field changed from X to Y' },
];

export function AutomationConditionsBuilder({
  conditions,
  eventTypes,
  entityType,
  onChange,
  inline = false,
}: AutomationConditionsBuilderProps) {
  const hasUpdatedEvent = eventTypes.includes('UPDATED');
  const hasCreatedEvent = eventTypes.includes('CREATED');

  const form = useForm<ConditionFormData>({
    resolver: zodResolver(conditionSchema),
    defaultValues: {
      field: conditions?.field || '',
      operator: conditions?.operator || 'equals',
      value: conditions?.value,
      old_value: conditions?.old_value,
      new_value: conditions?.new_value,
    },
  });

  const selectedOperator = form.watch('operator');
  const isFieldChangeOperator = ['field_changed', 'changed_from', 'changed_to', 'changed_from_to'].includes(selectedOperator);

  // Update form when conditions prop changes
  useEffect(() => {
    if (conditions) {
      form.reset({
        field: conditions.field,
        operator: conditions.operator,
        value: conditions.value,
        old_value: conditions.old_value,
        new_value: conditions.new_value,
      });
    } else {
      form.reset({
        field: '',
        operator: 'equals',
        value: undefined,
        old_value: undefined,
        new_value: undefined,
      });
    }
  }, [conditions, form]);

  // Get available operators based on event types
  const availableOperators = [
    ...(hasCreatedEvent || !hasUpdatedEvent ? STANDARD_OPERATORS : []),
    ...(hasUpdatedEvent ? FIELD_CHANGE_OPERATORS : []),
  ];

  const handleSave = (data: ConditionFormData) => {
    const condition: AutomationCondition = {
      field: data.field,
      operator: data.operator as ConditionOperator,
    };

    if (data.operator === 'changed_from_to') {
      condition.old_value = data.old_value;
      condition.new_value = data.new_value;
    } else if (data.operator !== 'field_changed') {
      condition.value = data.value;
    }

    onChange(condition);
  };

  const handleClear = () => {
    form.reset({
      field: '',
      operator: 'equals',
      value: undefined,
      old_value: undefined,
      new_value: undefined,
    });
    onChange(null);
  };

  // Common field names by entity type (can be expanded)
  const getFieldSuggestions = (): string[] => {
    const commonFields: Record<string, string[]> = {
      tasks: ['status', 'priority', 'assigned_to', 'title', 'description', 'due_date', 'estimate', 'created_by'],
      students: ['status', 'year_level', 'curriculum', 'first_name', 'last_name', 'email', 'phone_number', 'parent_name', 'parent_email'],
      classes: ['status', 'day_of_week', 'start_time', 'end_time', 'subject_id', 'max_capacity'],
      sessions: ['status', 'start_at', 'end_at', 'class_id'],
      staff: ['role', 'status', 'first_name', 'last_name', 'email', 'phone_number'],
      parents: ['first_name', 'last_name', 'email', 'phone_number'],
      invoices: ['status', 'invoice_date', 'amount_due_cents', 'amount_paid_cents', 'currency', 'collection_method'],
      invoice_items: ['description', 'quantity', 'unit_amount_cents', 'total_amount_cents'],
      notes: ['note_type', 'content', 'target_type'],
      tutor_logs: ['session_id', 'status', 'started_at', 'ended_at'],
    };
    return commonFields[entityType] || [];
  };

  const fieldSuggestions = getFieldSuggestions();

  // Inline mode - render inline with sentence builder
  if (inline) {
    if (!conditions) {
      return (
        <Form {...form}>
          <div className="contents">
            <span>with</span>
            <FormField
              control={form.control}
              name="field"
              render={({ field }) => (
                <FormItem className="w-[140px] [&>div]:w-full">
                  <FormControl>
                    <div className="relative">
                      <Input
                        className="h-9 pr-8"
                        placeholder="Field name"
                        {...field}
                        list={`field-suggestions-inline-${entityType}`}
                      />
                      {fieldSuggestions.length > 0 && (
                        <datalist id={`field-suggestions-inline-${entityType}`}>
                          {fieldSuggestions.map((suggestion) => (
                            <option key={suggestion} value={suggestion} />
                          ))}
                        </datalist>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="operator"
              render={({ field }) => (
                <FormItem className="w-[140px] [&>div]:w-full">
                  <FormControl>
                    <SearchableSelect<{ value: ConditionOperator; label: string }>
                      items={availableOperators}
                      value={availableOperators.find((op) => op.value === field.value) ?? null}
                      onValueChange={(item) => item && field.onChange(item.value)}
                      getItemLabel={(op) => op.label}
                      getItemId={(op) => op.value}
                      placeholder="Operator"
                      triggerClassName="h-9"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {selectedOperator === 'changed_from_to' ? (
              <>
                <span>from</span>
                <FormField
                  control={form.control}
                  name="old_value"
                  render={({ field }) => (
                    <FormItem className="w-[120px] [&>div]:w-full">
                      <FormControl>
                        <Input
                          className="h-9"
                          placeholder="Value"
                          {...field}
                          value={field.value?.toString() || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            const numVal = Number(val);
                            field.onChange(isNaN(numVal) ? val : numVal);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <span>to</span>
                <FormField
                  control={form.control}
                  name="new_value"
                  render={({ field }) => (
                    <FormItem className="w-[120px] [&>div]:w-full">
                      <FormControl>
                        <Input
                          className="h-9"
                          placeholder="Value"
                          {...field}
                          value={field.value?.toString() || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            const numVal = Number(val);
                            field.onChange(isNaN(numVal) ? val : numVal);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-9"
                  onClick={form.handleSubmit(handleSave)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </>
            ) : selectedOperator !== 'field_changed' ? (
              <>
                {(selectedOperator === 'changed_from' || selectedOperator === 'changed_to') && (
                  <span>{selectedOperator === 'changed_from' ? 'from' : 'to'}</span>
                )}
                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => (
                    <FormItem className="w-[120px] [&>div]:w-full">
                      <FormControl>
                        <Input
                          className="h-9"
                          placeholder="Value"
                          {...field}
                          value={field.value?.toString() || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'true') {
                              field.onChange(true);
                            } else if (val === 'false') {
                              field.onChange(false);
                            } else {
                              const numVal = Number(val);
                              field.onChange(isNaN(numVal) ? val : numVal);
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-9"
                  onClick={form.handleSubmit(handleSave)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                className="h-9"
                onClick={form.handleSubmit(handleSave)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </Form>
      );
    }
    // Show existing condition inline
    return null; // This will be handled by parent component
  }

  // Card mode - original implementation
  return (
    <div className="space-y-2">
      {!conditions ? (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
            <FormField
              control={form.control}
              name="field"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Field Name</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <Input
                        placeholder="e.g., status, priority, assigned_to"
                        {...field}
                        list={`field-suggestions-${entityType}`}
                      />
                      {fieldSuggestions.length > 0 && (
                        <datalist id={`field-suggestions-${entityType}`}>
                          {fieldSuggestions.map((suggestion) => (
                            <option key={suggestion} value={suggestion} />
                          ))}
                        </datalist>
                      )}
                    </div>
                  </FormControl>
                  <FormDescription>Name of the field to check</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="operator"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Operator</FormLabel>
                  <FormControl>
                    <SearchableSelect<{ value: ConditionOperator; label: string; description: string }>
                      items={availableOperators}
                      value={availableOperators.find((op) => op.value === field.value) ?? null}
                      onValueChange={(item) => item && field.onChange(item.value)}
                      getItemLabel={(op) => op.label}
                      getItemId={(op) => op.value}
                      renderItem={(op, isSelected) => (
                        <div>
                          <div className={isSelected ? "font-semibold" : "font-medium"}>{op.label}</div>
                          <div className="text-xs text-muted-foreground">{op.description}</div>
                        </div>
                      )}
                    />
                  </FormControl>
                  <FormDescription>
                    {isFieldChangeOperator && !hasUpdatedEvent
                      ? '⚠️ Field change operators only work with UPDATED events'
                      : 'How to evaluate the field'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedOperator === 'changed_from_to' ? (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="old_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Old Value</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Previous value"
                          {...field}
                          value={field.value?.toString() || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            const numVal = Number(val);
                            field.onChange(isNaN(numVal) ? val : numVal);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="new_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Value</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="New value"
                          {...field}
                          value={field.value?.toString() || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            const numVal = Number(val);
                            field.onChange(isNaN(numVal) ? val : numVal);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : selectedOperator !== 'field_changed' ? (
              <FormField
                control={form.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {selectedOperator === 'changed_from' ? 'Old Value' : selectedOperator === 'changed_to' ? 'New Value' : 'Value'}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter value"
                        {...field}
                        value={field.value?.toString() || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'true') {
                            field.onChange(true);
                          } else if (val === 'false') {
                            field.onChange(false);
                          } else {
                            const numVal = Number(val);
                            field.onChange(isNaN(numVal) ? val : numVal);
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <Button type="button" size="sm" onClick={form.handleSubmit(handleSave)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Condition
            </Button>
          </form>
        </Form>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
            <div className="flex-1">
              <div className="font-medium">{conditions.field}</div>
              <div className="text-sm text-muted-foreground">
                {conditions.operator === 'changed_from_to' ? (
                  <>
                    Changed from <Badge variant="outline">{String(conditions.old_value)}</Badge> to{' '}
                    <Badge variant="outline">{String(conditions.new_value)}</Badge>
                  </>
                ) : conditions.operator === 'field_changed' ? (
                  'Field was changed'
                ) : (
                  <>
                    {conditions.operator} <Badge variant="outline">{String(conditions.value)}</Badge>
                  </>
                )}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClear}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={handleClear} className="w-full">
            Edit Condition
          </Button>
        </div>
      )}
    </div>
  );
}
