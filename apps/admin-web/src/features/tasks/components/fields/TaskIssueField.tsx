'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@altitutor/ui';
import { Button, Input, Popover, PopoverContent, PopoverTrigger, ScrollArea } from '@altitutor/ui';
import { Check, Link2, Loader2 } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
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
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [issueSearchQuery, setIssueSearchQuery] = useState('');
  const { data: issues = [], isLoading } = useIssues();

  const filteredIssues = useMemo(() => {
    const query = issueSearchQuery.trim().toLowerCase();
    if (!query) return issues;
    return issues.filter((issue) => (issue.name || '').toLowerCase().includes(query));
  }, [issues, issueSearchQuery]);

  useEffect(() => {
    const currentIssueId = form.getValues('issueId');
    if (selectedIssue && currentIssueId !== selectedIssue.id) {
      form.setValue('issueId', selectedIssue.id, { shouldDirty: false });
    } else if (!selectedIssue && currentIssueId !== null) {
      form.setValue('issueId', null, { shouldDirty: false });
    }
  }, [selectedIssue, form]);

  return (
    <FormField
      control={form.control}
      name="issueId"
      render={({ field: _field }) => (
        <FormItem>
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <FormControl>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsPopoverOpen(true);
                  }}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="truncate text-left">
                      {selectedIssue?.name || 'Link issue'}
                    </span>
                  </div>
                </Button>
              </FormControl>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[400px]" align="start">
              <div className="p-3">
                <Input
                  type="text"
                  placeholder="Search issues..."
                  value={issueSearchQuery}
                  onChange={(e) => setIssueSearchQuery(e.target.value)}
                  className="mb-3"
                />
                <ScrollArea className="h-[300px]">
                  <div className="space-y-1 pr-4">
                    <Button
                      variant="ghost"
                      className="w-full justify-start h-auto p-3"
                      onClick={() => {
                        onIssueChange(null);
                        setIsPopoverOpen(false);
                        setIssueSearchQuery('');
                      }}
                    >
                      <div className="flex items-center gap-2 w-full">
                        {!selectedIssue && <Check className="h-4 w-4" />}
                        <span className={!selectedIssue ? 'font-medium' : ''}>
                          No issue
                        </span>
                      </div>
                    </Button>
                    {isLoading ? (
                      <div className="p-3 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading issues...
                      </div>
                    ) : filteredIssues.length === 0 ? (
                      <div className="p-3 text-center text-sm text-muted-foreground">
                        {issueSearchQuery ? 'No issues match your search' : 'No issues found'}
                      </div>
                    ) : (
                      filteredIssues.map((issue) => (
                        <Button
                          key={issue.id}
                          variant="ghost"
                          className="w-full justify-start h-auto p-3"
                          onClick={() => {
                            onIssueChange({ id: issue.id, name: issue.name });
                            setIsPopoverOpen(false);
                            setIssueSearchQuery('');
                          }}
                        >
                          <div className="flex items-center gap-2 w-full min-w-0">
                            {selectedIssue?.id === issue.id && (
                              <Check className="h-4 w-4 flex-shrink-0" />
                            )}
                            <span className={selectedIssue?.id === issue.id ? 'font-medium truncate' : 'truncate'}>
                              {issue.name || 'Untitled issue'}
                            </span>
                          </div>
                        </Button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </PopoverContent>
          </Popover>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
