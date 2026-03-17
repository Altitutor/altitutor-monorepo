'use client';

import { useMemo, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  FormField,
  FormItem,
  FormControl,
  Button,
  Input,
  SearchableSelect,
} from '@altitutor/ui';
import { cn } from '@/shared/utils';
import { Calendar, User, Flag } from 'lucide-react';
import { useStaffSearch } from '@/features/tasks/hooks/useStaffSearch';
import type { Tables } from '@altitutor/shared';
import type { ProjectFormData, ProjectPriority, ProjectStatus } from '../../types';
import {
  getProjectStatusIcon,
  getProjectStatusIconColor,
  getProjectStatusLabel,
  getProjectPriorityIcon,
  getProjectPriorityLabel,
  getProjectPriorityIconColor,
  PROJECT_STATUS_OPTIONS,
  PRIORITY_OPTIONS,
} from '../../utils/projectUtils';

export function ProjectPropertyPills({ form, enabled = true }: { form: UseFormReturn<ProjectFormData>; enabled?: boolean }) {
  const [leadOpen, setLeadOpen] = useState(false);
  const [leadSearchQuery, setLeadSearchQuery] = useState('');
  const { staff: staffList, isLoading: isLeadLoading } = useStaffSearch(
    leadSearchQuery,
    enabled && leadOpen
  );

  const selectedLeadId = form.watch('projectLeadId');
  const selectedLead = useMemo(
    () => staffList.find((s) => s.id === selectedLeadId) || null,
    [staffList, selectedLeadId]
  ) as Tables<'staff'> | null;

  return (
    <div className="flex flex-wrap gap-2 pb-2 md:hidden">
      <FormField
        control={form.control}
        name="status"
        render={({ field }) => {
          const status = field.value;
          const StatusIcon = getProjectStatusIcon(status);
          const statusIconColor = getProjectStatusIconColor(status);
          return (
            <FormItem>
              <Select value={status} onValueChange={(value) => field.onChange(value as ProjectStatus)}>
                <FormControl>
                  <SelectTrigger className="h-8 rounded-full px-3 text-xs w-auto">
                    <div className="flex items-center gap-1.5">
                      <StatusIcon className={cn('h-3 w-3', statusIconColor)} />
                      <span>{getProjectStatusLabel(status)}</span>
                    </div>
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {PROJECT_STATUS_OPTIONS.map((opt) => {
                    const OptionIcon = getProjectStatusIcon(opt.value);
                    const optionColor = getProjectStatusIconColor(opt.value);
                    return (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center gap-2">
                          <OptionIcon className={cn('h-4 w-4', optionColor)} />
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

      <FormField
        control={form.control}
        name="priority"
        render={({ field }) => {
          const priority = (field.value ?? 0) as ProjectPriority;
          const PriorityIcon = getProjectPriorityIcon(priority);
          const priorityIconColor = getProjectPriorityIconColor(priority);
          return (
            <FormItem>
              <Select
                value={String(priority)}
                onValueChange={(value) => field.onChange(Number(value) as ProjectPriority)}
              >
                <FormControl>
                  <SelectTrigger className="h-8 rounded-full px-3 text-xs w-auto">
                    <div className="flex items-center gap-1.5">
                      <PriorityIcon className={cn('h-3 w-3', priorityIconColor)} />
                      <span>{getProjectPriorityLabel(priority)}</span>
                    </div>
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((opt) => {
                    const OptionIcon = getProjectPriorityIcon(opt.value);
                    const optionColor = getProjectPriorityIconColor(opt.value);
                    return (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        <div className="flex items-center gap-2">
                          <OptionIcon className={cn('h-4 w-4', optionColor)} />
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

      <FormField
        control={form.control}
        name="projectLeadId"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <SearchableSelect<Tables<'staff'>>
                items={staffList}
                value={selectedLead}
                onValueChange={(staff) => field.onChange(staff?.id ?? null)}
                getItemId={(s) => s.id}
                getItemLabel={(s) => `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Unnamed staff'}
                getItemValue={(s) => `${s.first_name || ''} ${s.last_name || ''}`.trim()}
                placeholder="Lead"
                searchPlaceholder="Search staff..."
                emptyMessage={leadSearchQuery ? 'No staff match your search' : 'No staff found'}
                trigger={
                  <Button variant="outline" className="h-8 rounded-full px-3 text-xs">
                    <User className="h-3 w-3 mr-1" />
                    <span className="max-w-[120px] truncate">
                      {selectedLead ? `${selectedLead.first_name || ''} ${selectedLead.last_name || ''}`.trim() : 'Lead'}
                    </span>
                  </Button>
                }
                allowClear
                loading={isLeadLoading}
                contentWidth="300px"
                align="start"
                onSearchChange={setLeadSearchQuery}
                open={leadOpen}
                onOpenChange={setLeadOpen}
                disabled={!enabled}
              />
            </FormControl>
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="startDate"
        render={({ field }) => {
          const dateValue = field.value ? (typeof field.value === 'string' ? field.value.split('T')[0] : new Date(field.value).toISOString().split('T')[0]) : '';
          return (
            <FormItem>
              <FormControl>
                <div className="relative flex items-center h-8 min-w-[90px] rounded-full border bg-background">
                  <Calendar className="h-3 w-3 flex-shrink-0 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                  <Input
                    type="date"
                    value={dateValue}
                    onChange={(e) => field.onChange(e.target.value || null)}
                    onBlur={field.onBlur}
                    className="h-8 border-0 bg-transparent pl-8 pr-2 text-xs rounded-full focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
              </FormControl>
            </FormItem>
          );
        }}
      />

      <FormField
        control={form.control}
        name="targetDate"
        render={({ field }) => {
          const dateValue = field.value ? (typeof field.value === 'string' ? field.value.split('T')[0] : new Date(field.value).toISOString().split('T')[0]) : '';
          return (
            <FormItem>
              <FormControl>
                <div className="relative flex items-center h-8 min-w-[90px] rounded-full border bg-background">
                  <Flag className="h-3 w-3 flex-shrink-0 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                  <Input
                    type="date"
                    value={dateValue}
                    onChange={(e) => field.onChange(e.target.value || null)}
                    onBlur={field.onBlur}
                    className="h-8 border-0 bg-transparent pl-8 pr-2 text-xs rounded-full focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
              </FormControl>
            </FormItem>
          );
        }}
      />
    </div>
  );
}

