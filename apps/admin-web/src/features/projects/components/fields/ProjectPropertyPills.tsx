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
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
} from '@altitutor/ui';
import { DatePickerPopover } from '@/shared/components/DatePickerPopover';
import { Calendar, Check, Flag, User } from 'lucide-react';
import { useStaffSearch } from '@/features/tasks/hooks/useStaffSearch';
import type { ProjectFormData, ProjectPriority, ProjectStatus } from '../../types';
import { getProjectPriorityLabel, getProjectStatusLabel, formatProjectDate } from '../../utils/projectUtils';

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

const PRIORITY_OPTIONS: { value: ProjectPriority; label: string }[] = [
  { value: 0, label: 'No priority' },
  { value: 1, label: 'Urgent' },
  { value: 2, label: 'High' },
  { value: 3, label: 'Medium' },
  { value: 4, label: 'Low' },
];

export function ProjectPropertyPills({ form, enabled = true }: { form: UseFormReturn<ProjectFormData>; enabled?: boolean }) {
  const [isLeadPopoverOpen, setIsLeadPopoverOpen] = useState(false);
  const [leadSearchQuery, setLeadSearchQuery] = useState('');
  const { staff: staffList } = useStaffSearch('', enabled);

  const selectedLeadId = form.watch('projectLeadId');
  const selectedLead = useMemo(
    () => staffList.find((s) => s.id === selectedLeadId) || null,
    [staffList, selectedLeadId]
  );

  const filteredStaff = useMemo(() => {
    const query = leadSearchQuery.trim().toLowerCase();
    if (!query) return staffList;
    return staffList.filter((staff) => `${staff.first_name || ''} ${staff.last_name || ''}`.toLowerCase().includes(query));
  }, [staffList, leadSearchQuery]);

  return (
    <div className="flex flex-wrap gap-2 pb-2 md:hidden">
      <FormField
        control={form.control}
        name="status"
        render={({ field }) => (
          <FormItem>
            <Select value={field.value} onValueChange={(value) => field.onChange(value as ProjectStatus)}>
              <FormControl>
                <SelectTrigger className="h-8 rounded-full px-3 text-xs w-auto">
                  {getProjectStatusLabel(field.value)}
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="priority"
        render={({ field }) => (
          <FormItem>
            <Select
              value={String(field.value)}
              onValueChange={(value) => field.onChange(Number(value) as ProjectPriority)}
            >
              <FormControl>
                <SelectTrigger className="h-8 rounded-full px-3 text-xs w-auto">
                  {getProjectPriorityLabel((field.value ?? 0) as ProjectPriority)}
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {PRIORITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormItem>
        )}
      />

      <Popover open={isLeadPopoverOpen} onOpenChange={setIsLeadPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-8 rounded-full px-3 text-xs">
            <User className="h-3 w-3 mr-1" />
            <span className="max-w-[120px] truncate">
              {selectedLead ? `${selectedLead.first_name || ''} ${selectedLead.last_name || ''}`.trim() : 'Lead'}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[300px]" align="start">
          <div className="p-3">
            <Input
              type="text"
              placeholder="Search staff..."
              value={leadSearchQuery}
              onChange={(e) => setLeadSearchQuery(e.target.value)}
              className="mb-3"
            />
            <ScrollArea className="h-[240px]">
              <div className="space-y-1 pr-3">
                <Button
                  variant="ghost"
                  className="w-full justify-start h-auto p-3"
                  onClick={() => {
                    form.setValue('projectLeadId', null, { shouldDirty: true });
                    setIsLeadPopoverOpen(false);
                    setLeadSearchQuery('');
                  }}
                >
                  <div className="flex items-center gap-2 w-full">
                    {!selectedLeadId && <Check className="h-4 w-4" />}
                    <span className={!selectedLeadId ? 'font-medium' : ''}>No lead</span>
                  </div>
                </Button>
                {filteredStaff.map((staff) => (
                  <Button
                    key={staff.id}
                    variant="ghost"
                    className="w-full justify-start h-auto p-3"
                    onClick={() => {
                      form.setValue('projectLeadId', staff.id, { shouldDirty: true });
                      setIsLeadPopoverOpen(false);
                      setLeadSearchQuery('');
                    }}
                  >
                    <div className="flex items-center gap-2 w-full min-w-0">
                      {selectedLeadId === staff.id && <Check className="h-4 w-4 flex-shrink-0" />}
                      <span className={selectedLeadId === staff.id ? 'font-medium truncate' : 'truncate'}>
                        {`${staff.first_name || ''} ${staff.last_name || ''}`.trim() || 'Unnamed staff'}
                      </span>
                    </div>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </PopoverContent>
      </Popover>

      <FormField
        control={form.control}
        name="startDate"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <DatePickerPopover
                value={field.value}
                onChange={(v) => field.onChange(v ? v.split('T')[0] : null)}
                onBlur={field.onBlur}
                name={field.name}
                modal={false}
              >
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full border bg-background px-3 h-8 text-xs cursor-pointer"
                >
                  <Calendar className="h-3 w-3" />
                  <span>{field.value ? formatProjectDate(field.value) : 'Start'}</span>
                </button>
              </DatePickerPopover>
            </FormControl>
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="targetDate"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <DatePickerPopover
                value={field.value}
                onChange={(v) => field.onChange(v ? v.split('T')[0] : null)}
                onBlur={field.onBlur}
                name={field.name}
                modal={false}
              >
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full border bg-background px-3 h-8 text-xs cursor-pointer"
                >
                  <Flag className="h-3 w-3" />
                  <span>{field.value ? formatProjectDate(field.value) : 'Target'}</span>
                </button>
              </DatePickerPopover>
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  );
}

