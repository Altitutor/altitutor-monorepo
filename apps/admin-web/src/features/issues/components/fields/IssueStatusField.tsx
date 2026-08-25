'use client';

import {
  Button,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  SearchableSelect,
} from '@altitutor/ui';
import { UseFormReturn } from 'react-hook-form';
import { cn } from '@/shared/utils';
import type { IssueFormData, IssueStatus } from '../../types';
import {
  getIssueStatusIcon,
  getIssueStatusIconColor,
  getIssueStatusLabel,
  ISSUE_STATUS_OPTIONS,
} from '../../utils/issueUtils';

interface IssueStatusFieldProps {
  form: UseFormReturn<IssueFormData>;
}

type StatusOption = (typeof ISSUE_STATUS_OPTIONS)[number];

export function IssueStatusField({ form }: IssueStatusFieldProps) {
  return (
    <FormField
      control={form.control}
      name="status"
      render={({ field }) => {
        const value = (field.value ?? 'open') as IssueStatus;
        const StatusIcon = getIssueStatusIcon(value);
        const iconColor = getIssueStatusIconColor(value);
        const label = getIssueStatusLabel(value);
        const selectedItem =
          ISSUE_STATUS_OPTIONS.find((option) => option.value === value) ?? ISSUE_STATUS_OPTIONS[0];

        return (
          <FormItem>
            <FormControl>
              <SearchableSelect<StatusOption>
                items={ISSUE_STATUS_OPTIONS}
                value={selectedItem}
                onValueChange={(item) => field.onChange(item ? item.value : 'open')}
                getItemLabel={(option) => option.label}
                getItemId={(option) => option.value}
                fullWidth
                trigger={
                  <Button type="button" variant="field" className="w-full justify-start font-normal">
                    <StatusIcon className={cn('h-4 w-4', iconColor)} />
                    <span>{label}</span>
                  </Button>
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
