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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@altitutor/ui';
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
      tasks: ['status', 'priority', 'assigned_to', 'title', 'description'],
      students: ['status', 'year_level', 'curriculum', 'first_name', 'last_name'],
      classes: ['status', 'day_of_week', 'start_time', 'end_time', 'subject_id'],
      sessions: ['status', 'start_at', 'end_at', 'class_id'],
      invoices: ['status', 'due_date', 'total_amount'],
    };
    return commonFields[entityType] || [];
  };

  const fieldSuggestions = getFieldSuggestions();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Conditions</CardTitle>
            <CardDescription>
              {hasUpdatedEvent && hasCreatedEvent
                ? 'Set conditions based on field values or field changes'
                : hasUpdatedEvent
                ? 'Set conditions based on field changes (only works for UPDATED events)'
                : 'Set conditions based on current field values'}
            </CardDescription>
          </div>
          {conditions && (
            <Button variant="ghost" size="sm" onClick={handleClear}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableOperators.map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            <div>
                              <div className="font-medium">{op.label}</div>
                              <div className="text-xs text-muted-foreground">{op.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                              // Try to parse as number, otherwise keep as string
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
                            // Try to parse as number or boolean, otherwise keep as string
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
      </CardContent>
    </Card>
  );
}
