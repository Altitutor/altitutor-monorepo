'use client';

import { Button, Input, SearchableSelect } from '@altitutor/ui';
import { Plus, X } from 'lucide-react';
import type {
  ActivityEventType,
  AutomationCondition,
  AutomationConditionExpression,
  AutomationConditionGroup,
  ConditionOperator,
} from '../types';

interface AutomationConditionsBuilderProps {
  conditions: AutomationConditionExpression | null;
  eventTypes: ActivityEventType[];
  entityType: string;
  onChange: (condition: AutomationConditionExpression | null) => void;
  inline?: boolean;
}

const STANDARD_OPERATORS: Array<{ value: ConditionOperator; label: string }> = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Does not equal' },
  { value: 'in', label: 'Is one of' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does not contain' },
  { value: 'greater_than', label: 'Greater than' },
  { value: 'less_than', label: 'Less than' },
];

const CHANGE_OPERATORS: Array<{ value: ConditionOperator; label: string }> = [
  { value: 'field_changed', label: 'Changed' },
  { value: 'changed_from', label: 'Changed from' },
  { value: 'changed_to', label: 'Changed to' },
  { value: 'changed_from_to', label: 'Changed from/to' },
];

const FIELD_SUGGESTIONS: Record<string, string[]> = {
  tasks: ['status', 'priority', 'assigned_to', 'title', 'due_date'],
  students: ['status', 'year_level', 'curriculum', 'first_name', 'last_name'],
  classes: ['status', 'day_of_week', 'start_time', 'end_time', 'subject_id'],
  sessions: ['session.type', 'session.status', 'start_at', 'end_at', 'class_id'],
  sessions_students: ['session.type', 'session.status', 'student_id', 'session_id'],
  staff: ['role', 'status', 'first_name', 'last_name'],
  parents: ['first_name', 'last_name', 'email', 'phone'],
  invoices: ['status', 'invoice_date', 'amount_due_cents', 'amount_paid_cents'],
  invoice_items: ['description', 'quantity', 'unit_amount_cents'],
  notes: ['note_type', 'target_type'],
  tutor_logs: ['session.type', 'session.status', 'session_id'],
};

function isGroup(expression: AutomationConditionExpression): expression is AutomationConditionGroup {
  return 'all' in expression || 'any' in expression;
}

function emptyCondition(): AutomationCondition {
  return { field: '', operator: 'equals', value: '' };
}

function parseValue(operator: ConditionOperator, value: string) {
  if (operator === 'in') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  const numeric = Number(value);
  return value.trim() !== '' && Number.isFinite(numeric) ? numeric : value;
}

function displayValue(condition: AutomationCondition): string {
  return Array.isArray(condition.value)
    ? condition.value.join(', ')
    : condition.value == null ? '' : String(condition.value);
}

interface NodeEditorProps {
  expression: AutomationConditionExpression;
  onChange: (expression: AutomationConditionExpression) => void;
  onRemove: () => void;
  operators: Array<{ value: ConditionOperator; label: string }>;
  suggestions: string[];
  depth: number;
}

function NodeEditor({ expression, onChange, onRemove, operators, suggestions, depth }: NodeEditorProps) {
  if (isGroup(expression)) {
    const logic = expression.any ? 'any' : 'all';
    const children = expression[logic] ?? [];
    const setChildren = (next: AutomationConditionExpression[]) =>
      onChange(logic === 'all' ? { all: next } : { any: next });

    return (
      <div className="space-y-3 rounded-md border p-3">
        <div className="flex items-center gap-2">
          <SearchableSelect
            items={[{ id: 'all', label: 'All conditions' }, { id: 'any', label: 'Any condition' }]}
            value={{ id: logic, label: logic === 'all' ? 'All conditions' : 'Any condition' }}
            onValueChange={(item) => {
              const nextLogic = item?.id === 'any' ? 'any' : 'all';
              onChange(nextLogic === 'all' ? { all: children } : { any: children });
            }}
            getItemId={(item) => item.id}
            getItemLabel={(item) => item.label}
            triggerClassName="h-9 w-[160px]"
          />
          <Button type="button" variant="ghost" size="icon" onClick={onRemove}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {children.map((child, index) => (
          <NodeEditor
            key={index}
            expression={child}
            operators={operators}
            suggestions={suggestions}
            depth={depth + 1}
            onChange={(next) => setChildren(children.map((item, i) => i === index ? next : item))}
            onRemove={() => setChildren(children.filter((_, i) => i !== index))}
          />
        ))}

        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setChildren([...children, emptyCondition()])}>
            <Plus className="mr-2 h-4 w-4" />Condition
          </Button>
          {depth < 2 && (
            <Button type="button" variant="outline" size="sm" onClick={() => setChildren([...children, { any: [emptyCondition()] }])}>
              <Plus className="mr-2 h-4 w-4" />Group
            </Button>
          )}
        </div>
      </div>
    );
  }

  const update = (updates: Partial<AutomationCondition>) => onChange({ ...expression, ...updates });
  const selectedOperator = operators.find((operator) => operator.value === expression.operator) ?? operators[0];

  return (
    <div className="flex flex-wrap items-start gap-2 rounded-md border p-3">
      <div className="min-w-[180px] flex-1">
        <Input
          value={expression.field}
          placeholder="Field, e.g. session.type"
          list={`automation-fields-${depth}`}
          onChange={(event) => update({ field: event.target.value })}
        />
        <datalist id={`automation-fields-${depth}`}>
          {suggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}
        </datalist>
      </div>
      <SearchableSelect
        items={operators}
        value={selectedOperator}
        onValueChange={(item) => item && update({ operator: item.value })}
        getItemId={(item) => item.value}
        getItemLabel={(item) => item.label}
        triggerClassName="h-10 w-[160px]"
      />
      {expression.operator === 'changed_from_to' ? (
        <>
          <Input className="w-[130px]" placeholder="Old value" value={String(expression.old_value ?? '')} onChange={(event) => update({ old_value: parseValue('equals', event.target.value) as string | number | boolean })} />
          <Input className="w-[130px]" placeholder="New value" value={String(expression.new_value ?? '')} onChange={(event) => update({ new_value: parseValue('equals', event.target.value) as string | number | boolean })} />
        </>
      ) : expression.operator !== 'field_changed' ? (
        <Input
          className="w-[220px]"
          placeholder={expression.operator === 'in' ? 'Comma-separated values' : 'Value'}
          value={displayValue(expression)}
          onChange={(event) => update({ value: parseValue(expression.operator, event.target.value) })}
        />
      ) : null}
      <Button type="button" variant="ghost" size="icon" onClick={onRemove}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function AutomationConditionsBuilder({
  conditions,
  eventTypes,
  entityType,
  onChange,
  inline: _inline = false,
}: AutomationConditionsBuilderProps) {
  const operators = eventTypes.includes('UPDATED')
    ? [...STANDARD_OPERATORS, ...CHANGE_OPERATORS]
    : STANDARD_OPERATORS;
  const suggestions = FIELD_SUGGESTIONS[entityType] ?? [];

  if (!conditions) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => onChange(emptyCondition())}>
        <Plus className="mr-2 h-4 w-4" />Add condition
      </Button>
    );
  }

  return (
    <NodeEditor
      expression={conditions}
      operators={operators}
      suggestions={suggestions}
      depth={0}
      onChange={onChange}
      onRemove={() => onChange(null)}
    />
  );
}
