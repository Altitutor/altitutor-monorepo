'use client';

import { FormControl, FormField, FormItem } from '@altitutor/ui';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@altitutor/ui';
import { UseFormReturn } from 'react-hook-form';
import { cn } from '@/shared/utils';
import type { IssueFormData } from '../../types';
import {
  getIssueStatusIcon,
  getIssueStatusIconColor,
  getIssueStatusLabel,
  ISSUE_STATUS_OPTIONS,
} from '../../utils/issueUtils';

interface IssueStatusPillProps {
  form: UseFormReturn<IssueFormData>;
}

export function IssueStatusPill({ form }: IssueStatusPillProps) {
  return (
    <FormField
      control={form.control}
      name="status"
      render={({ field }) => {
        const value = field.value ?? 'open';
        const StatusIcon = getIssueStatusIcon(value);
        const iconColor = getIssueStatusIconColor(value);
        const label = getIssueStatusLabel(value);

        return (
          <FormItem className="w-fit">
            <Select onValueChange={field.onChange} value={value}>
              <FormControl>
                <SelectTrigger className="h-8 w-fit px-3 text-xs border rounded-full">
                  <div className="flex items-center gap-1.5">
                    <StatusIcon className={cn('h-3 w-3', iconColor)} />
                    <span>{label}</span>
                  </div>
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {ISSUE_STATUS_OPTIONS.map((opt) => {
                  const Icon = getIssueStatusIcon(opt.value);
                  const optionColor = getIssueStatusIconColor(opt.value);
                  return (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <Icon className={cn('h-4 w-4', optionColor)} />
                        <span>{opt.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </FormItem>
        );
      }}
    />
  );
}
