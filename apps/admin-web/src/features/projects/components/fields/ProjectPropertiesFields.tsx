'use client';

import { useMemo, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Input,
  ScrollArea,
} from '@altitutor/ui';
import { cn } from '@/shared/utils';
import { Check, User, Calendar, Flag } from 'lucide-react';
import { useStaffSearch } from '@/features/tasks/hooks/useStaffSearch';
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
            <Popover open={isLeadPopoverOpen} onOpenChange={setIsLeadPopoverOpen}>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button variant="outline" className="w-full justify-start">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground shrink-0">Lead</span>
                      <span className="truncate text-left">
                        {selectedLead ? `${selectedLead.first_name || ''} ${selectedLead.last_name || ''}`.trim() : 'Assign lead'}
                      </span>
                    </div>
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[340px]" align="start">
                <div className="p-3">
                  <Input
                    type="text"
                    placeholder="Search staff..."
                    value={leadSearchQuery}
                    onChange={(e) => setLeadSearchQuery(e.target.value)}
                    className="mb-3"
                  />
                  <ScrollArea className="h-[280px]">
                    <div className="space-y-1 pr-3">
                      <Button
                        variant="ghost"
                        className="w-full justify-start h-auto p-3"
                        onClick={() => {
                          field.onChange(null);
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
                            field.onChange(staff.id);
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
