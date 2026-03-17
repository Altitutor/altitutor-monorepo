'use client';

import { useMemo, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  Button,
  SearchableSelect,
} from '@altitutor/ui';
import { cn } from '@/shared/utils';
import { User, Calendar, Flag } from 'lucide-react';
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

export function ProjectPropertiesFields({ form, enabled = true }: { form: UseFormReturn<ProjectFormData>; enabled?: boolean }) {
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

  const selectedStatus = form.watch('status');
  const StatusIcon = getProjectStatusIcon(selectedStatus);
  const statusIconColor = getProjectStatusIconColor(selectedStatus);

  return (
    <div className="space-y-6">
      <FormField
        control={form.control}
        name="status"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Select value={field.value} onValueChange={(value) => field.onChange(value as ProjectStatus)}>
                <SelectTrigger>
                  <div className="flex items-center gap-2 w-full min-w-0">
                    <StatusIcon className={cn('h-4 w-4', statusIconColor)} />
                    <span className="text-muted-foreground shrink-0">Status</span>
                    <span className="truncate">{getProjectStatusLabel(field.value)}</span>
                  </div>
                </SelectTrigger>
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
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="priority"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Select
                value={String(field.value)}
                onValueChange={(value) => field.onChange(Number(value) as ProjectPriority)}
              >
                <SelectTrigger>
                  <div className="flex items-center gap-2 w-full min-w-0">
                    {(() => {
                      const p = (field.value ?? 0) as ProjectPriority;
                      const PriorityIcon = getProjectPriorityIcon(p);
                      const priorityIconColor = getProjectPriorityIconColor(p);
                      return (
                        <>
                          <PriorityIcon className={cn('h-4 w-4', priorityIconColor)} />
                          <span className="text-muted-foreground shrink-0">Priority</span>
                          <span className="truncate">{getProjectPriorityLabel(p)}</span>
                        </>
                      );
                    })()}
                  </div>
                </SelectTrigger>
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
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
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
                placeholder="Assign lead"
                searchPlaceholder="Search staff..."
                emptyMessage={leadSearchQuery ? 'No staff match your search' : 'No staff found'}
                trigger={
                  <Button variant="outline" className="w-full justify-start">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground shrink-0">Lead</span>
                      <span className="truncate text-left">
                        {selectedLead ? `${selectedLead.first_name || ''} ${selectedLead.last_name || ''}`.trim() : 'Assign lead'}
                      </span>
                    </div>
                  </Button>
                }
                allowClear
                loading={isLeadLoading}
                contentWidth="340px"
                align="start"
                onSearchChange={setLeadSearchQuery}
                open={leadOpen}
                onOpenChange={setLeadOpen}
                disabled={!enabled}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="startDate"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <div className="relative">
                <Calendar className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  type="date"
                  value={field.value || ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  className="pl-9"
                />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="targetDate"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <div className="relative">
                <Flag className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  type="date"
                  value={field.value || ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  className="pl-9"
                />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
