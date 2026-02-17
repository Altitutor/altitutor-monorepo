'use client';

import {
  FormControl,
  FormField,
  FormItem,
} from '@altitutor/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';
import { Clock, Circle, CheckCircle } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { cn } from '@/shared/utils';
import type { IssueStatus } from '../../types';

interface IssueStatusPillProps {
  form: UseFormReturn<{ status: IssueStatus }>;
}

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open', icon: Circle, color: 'text-blue-500' },
  { value: 'awaiting_response', label: 'Awaiting Response', icon: Clock, color: 'text-yellow-500' },
  { value: 'resolved', label: 'Resolved', icon: CheckCircle, color: 'text-green-500' },
  { value: 'closed', label: 'Closed', icon: Circle, color: 'text-gray-500' },
] as const;

export function IssueStatusPill({ form }: IssueStatusPillProps) {
  return (
    <FormField
      control={form.control}
      name="status"
      render={({ field }) => {
        const option = STATUS_OPTIONS.find(o => o.value === field.value) || STATUS_OPTIONS[0];
        const Icon = option.icon;

        return (
          <FormItem>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger className="h-8 px-3 text-xs border rounded-full">
                  <div className="flex items-center gap-1.5">
                    <Icon className={cn('h-3 w-3', option.color)} />
                    <SelectValue placeholder="Select status" />
                  </div>
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex items-center gap-2">
                      <opt.icon className={cn("h-4 w-4", opt.color)} />
                      <span>{opt.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormItem>
        );
      }}
    />
  );
}
