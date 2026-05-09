'use client';

import { useMemo, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import {
  FormField,
  FormItem,
  FormControl,
  Button,
  SearchableSelect,
} from '@altitutor/ui';
import { cn } from '@/shared/utils';
import { Calendar, User, Flag } from 'lucide-react';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function toInputValue(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

function formatDisplayDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
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
          const selected = PROJECT_STATUS_OPTIONS.find((o) => o.value === status) ?? PROJECT_STATUS_OPTIONS[0];
          return (
            <FormItem>
              <FormControl>
                <SearchableSelect<(typeof PROJECT_STATUS_OPTIONS)[number]>
                  items={PROJECT_STATUS_OPTIONS}
                  value={selected}
                  onValueChange={(item) => field.onChange(item?.value as ProjectStatus)}
                  getItemLabel={(o) => o.label}
                  getItemId={(o) => o.value}
                  trigger={
                    <Button variant="outline" className="h-8 rounded-full px-3 text-xs">
                      <StatusIcon className={cn('h-3 w-3', statusIconColor)} />
                      <span>{getProjectStatusLabel(status)}</span>
                    </Button>
                  }
                />
              </FormControl>
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
          const selected = PRIORITY_OPTIONS.find((o) => o.value === priority) ?? PRIORITY_OPTIONS[0];
          return (
            <FormItem>
              <FormControl>
                <SearchableSelect<(typeof PRIORITY_OPTIONS)[number]>
                  items={PRIORITY_OPTIONS}
                  value={selected}
                  onValueChange={(item) => field.onChange(item ? (item.value as ProjectPriority) : 0)}
                  getItemLabel={(o) => o.label}
                  getItemId={(o) => String(o.value)}
                  trigger={
                    <Button variant="outline" className="h-8 rounded-full px-3 text-xs">
                      <PriorityIcon className={cn('h-3 w-3', priorityIconColor)} />
                      <span>{getProjectPriorityLabel(priority)}</span>
                    </Button>
                  }
                />
              </FormControl>
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
          const dateValue = toInputValue(field.value);
          const formattedDate = formatDisplayDate(field.value);
          return (
            <FormItem>
              <FormControl>
                <div
                  className={cn(
                    'relative inline-flex items-center gap-1 h-7 rounded-full border bg-background cursor-pointer select-none',
                    formattedDate ? 'px-2' : 'w-7 justify-center',
                    !field.value && 'opacity-50'
                  )}
                >
                  <Calendar className="h-3 w-3 flex-shrink-0 pointer-events-none text-muted-foreground" />
                  {formattedDate && (
                    <span className="text-xs whitespace-nowrap pointer-events-none">{formattedDate}</span>
                  )}
                  <input
                    type="date"
                    value={dateValue}
                    onChange={(e) => field.onChange(e.target.value || null)}
                    onBlur={field.onBlur}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
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
          const dateValue = toInputValue(field.value);
          const formattedDate = formatDisplayDate(field.value);
          return (
            <FormItem>
              <FormControl>
                <div
                  className={cn(
                    'relative inline-flex items-center gap-1 h-7 rounded-full border bg-background cursor-pointer select-none',
                    formattedDate ? 'px-2' : 'w-7 justify-center',
                    !field.value && 'opacity-50'
                  )}
                >
                  <Flag className="h-3 w-3 flex-shrink-0 pointer-events-none text-muted-foreground" />
                  {formattedDate && (
                    <span className="text-xs whitespace-nowrap pointer-events-none">{formattedDate}</span>
                  )}
                  <input
                    type="date"
                    value={dateValue}
                    onChange={(e) => field.onChange(e.target.value || null)}
                    onBlur={field.onBlur}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
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

