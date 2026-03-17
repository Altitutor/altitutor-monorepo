'use client';

import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  SearchableSelect,
} from '@altitutor/ui';
import { Check, Link2 } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { cn } from '@/shared/utils';
import { useIssues } from '@/features/issues/api/queries';
import type { TaskFormData } from '../../types';

type IssueOption = {
  id: string;
  name: string | null;
};

interface TaskIssueFieldProps {
  form: UseFormReturn<TaskFormData>;
  selectedIssue: IssueOption | null;
  onIssueChange: (issue: IssueOption | null) => void;
}

export function TaskIssueField({
  form,
  selectedIssue,
  onIssueChange,
}: TaskIssueFieldProps) {
  const { data: issues = [], isLoading } = useIssues();

  const trigger = (
    <FormControl>
      <button
        type="button"
        className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border hover:bg-muted h-10 px-4 py-2 w-full justify-start"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className={cn('truncate text-left', !selectedIssue && 'text-muted-foreground')}>
            {selectedIssue?.name || 'Link issue'}
          </span>
        </div>
      </button>
    </FormControl>
  );

  return (
    <FormField
      control={form.control}
      name="issueId"
      render={({ field: _field }) => (
        <FormItem>
          <SearchableSelect<IssueOption>
            items={issues}
            value={selectedIssue}
            onValueChange={(issue) => {
              onIssueChange(issue);
              if (issue) {
                form.setValue('projectId', null, { shouldDirty: true });
              }
            }}
            getItemId={(i) => i.id}
            getItemLabel={(i) => i.name || 'Untitled issue'}
            placeholder="Link issue"
            searchPlaceholder="Search issues..."
            emptyMessage="No issues found"
            trigger={trigger}
            allowClear
            loading={isLoading}
            contentWidth="400px"
            renderItem={(issue, isSelected) => (
              <>
                <Check
                  className={
                    isSelected ? 'h-4 w-4 flex-shrink-0 opacity-100' : 'h-4 w-4 flex-shrink-0 opacity-0'
                  }
                />
                <span className={cn('truncate', isSelected && 'font-medium')}>
                  {issue.name || 'Untitled issue'}
                </span>
              </>
            )}
          />
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
