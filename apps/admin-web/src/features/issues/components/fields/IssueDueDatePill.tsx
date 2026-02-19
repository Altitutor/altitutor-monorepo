'use client';

import {
  FormControl,
  FormField,
  FormItem,
  Button,
} from '@altitutor/ui';
import { Calendar } from 'lucide-react';
import { useRef, type MutableRefObject } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { formatIssueDueDate } from '../../utils/issueUtils';

interface IssueDueDatePillProps {
  form: UseFormReturn<{ dueDate: string | null }>;
}

export function IssueDueDatePill({ form }: IssueDueDatePillProps) {
  const dateInputRef = useRef<HTMLInputElement | null>(null) as MutableRefObject<HTMLInputElement | null>;

  return (
    <FormField
      control={form.control}
      name="dueDate"
      render={({ field }) => {
        const dueDateValue = field.value;
        const dateValue = dueDateValue
          ? typeof dueDateValue === 'string'
            ? dueDateValue
            : new Date(dueDateValue).toISOString().split('T')[0]
          : null;

        return (
          <FormItem>
            <FormControl>
              <Button
                type="button"
                variant="outline"
                className="h-8 px-3 text-xs border rounded-full"
                onClick={(e) => {
                  e.preventDefault();
                  dateInputRef.current?.click();
                }}
              >
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span>{formatIssueDueDate(dueDateValue) || 'Due date'}</span>
                </div>
              </Button>
            </FormControl>
            <input
              ref={(el) => {
                dateInputRef.current = el;
                if (field.ref) {
                  if (typeof field.ref === 'function') {
                    field.ref(el);
                  } else if ('current' in field.ref) {
                    (field.ref as MutableRefObject<HTMLInputElement | null>).current = el;
                  }
                }
              }}
              type="date"
              name={field.name}
              onBlur={field.onBlur}
              value={dateValue || ''}
              onChange={(e) => {
                field.onChange(e.target.value || null);
              }}
              className="sr-only"
              tabIndex={-1}
            />
          </FormItem>
        );
      }}
    />
  );
}
