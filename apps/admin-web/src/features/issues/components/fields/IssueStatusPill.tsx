'use client';

import { Button, FormControl, FormField, FormItem, SearchableSelect } from '@altitutor/ui';
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

type StatusOption = (typeof ISSUE_STATUS_OPTIONS)[number];

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
        const selectedItem =
          ISSUE_STATUS_OPTIONS.find((o) => o.value === value) ?? ISSUE_STATUS_OPTIONS[0];

        return (
          <FormItem className="w-fit">
            <FormControl>
              <SearchableSelect<StatusOption>
                items={ISSUE_STATUS_OPTIONS}
                value={selectedItem}
                onValueChange={(item) => field.onChange(item ? item.value : 'open')}
                getItemLabel={(opt) => opt.label}
                getItemId={(opt) => opt.value}
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 w-fit rounded-full px-3 text-xs"
                  >
                    <StatusIcon className={cn('h-3 w-3', iconColor)} />
                    <span>{label}</span>
                  </Button>
                }
              />
            </FormControl>
          </FormItem>
        );
      }}
    />
  );
}
