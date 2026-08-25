'use client';

import { useEffect, useMemo, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SearchableSelectInline,
} from '@altitutor/ui';
import { Users } from 'lucide-react';
import { useStaffSearch } from '@/features/tasks/hooks/useStaffSearch';
import type { ProjectFormData } from '../../types';
import {
  staffDisplayName,
  type ProjectStaffRef,
} from '../../utils/projectMembers';

function uniqueStaff(staff: ProjectStaffRef[]): ProjectStaffRef[] {
  const seen = new Set<string>();
  return staff.filter((person) => {
    if (seen.has(person.id)) return false;
    seen.add(person.id);
    return true;
  });
}

export function ProjectMembersField({
  form,
  enabled = true,
  knownMembers = [],
  variant = 'properties',
}: {
  form: UseFormReturn<ProjectFormData>;
  enabled?: boolean;
  knownMembers?: ProjectStaffRef[];
  variant?: 'properties' | 'pills';
}) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cachedStaff, setCachedStaff] = useState<ProjectStaffRef[]>(knownMembers);
  const { staff: staffList, isLoading } = useStaffSearch(searchQuery, enabled && open);

  useEffect(() => {
    if (knownMembers.length === 0) return;
    setCachedStaff((current) => uniqueStaff([...current, ...knownMembers]));
  }, [knownMembers]);

  const leadId = form.watch('projectLeadId');
  const memberIds = form.watch('memberIds') ?? [];

  const selectedMembers = useMemo(() => {
    const byId = new Map<string, ProjectStaffRef>();
    for (const person of [...cachedStaff, ...knownMembers, ...staffList]) {
      byId.set(person.id, person);
    }
    return memberIds
      .filter((id) => id !== leadId)
      .map((id) => byId.get(id) ?? { id, first_name: null, last_name: null });
  }, [cachedStaff, knownMembers, staffList, memberIds, leadId]);

  const items = useMemo(
    () =>
      uniqueStaff([...staffList, ...selectedMembers]).filter((person) => person.id !== leadId),
    [staffList, selectedMembers, leadId]
  );

  const summary =
    selectedMembers.length === 0
      ? 'Add members'
      : selectedMembers.map(staffDisplayName).join(', ');

  const picker = (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setSearchQuery('');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="field"
          disabled={!enabled}
          className={
            variant === 'pills'
              ? 'h-8 rounded-full px-3 text-xs'
              : 'w-full justify-start'
          }
        >
          <div className="flex items-center gap-2 w-full min-w-0">
            <Users className={variant === 'pills' ? 'h-3 w-3 text-muted-foreground flex-shrink-0' : 'h-4 w-4 text-muted-foreground flex-shrink-0'} />
            <span className="truncate text-left">{summary}</span>
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[340px] p-0"
        enableModalScroll
      >
        <SearchableSelectInline<ProjectStaffRef>
          items={items}
          value={selectedMembers}
          onValueChange={(staff) => {
            setCachedStaff((current) => uniqueStaff([...current, ...staff]));
            form.setValue(
              'memberIds',
              staff.map((person) => person.id),
              { shouldDirty: true, shouldTouch: true }
            );
          }}
          getItemId={(person) => person.id}
          getItemLabel={staffDisplayName}
          searchPlaceholder="Search staff..."
          emptyMessage={searchQuery ? 'No staff match your search' : 'No staff found'}
          loading={isLoading}
          onSearchChange={setSearchQuery}
          multiSelect
        />
      </PopoverContent>
    </Popover>
  );

  if (variant === 'pills') {
    return (
      <FormField
        control={form.control}
        name="memberIds"
        render={() => (
          <FormItem>
            <FormControl>{picker}</FormControl>
          </FormItem>
        )}
      />
    );
  }

  return (
    <FormField
      control={form.control}
      name="memberIds"
      render={() => (
        <FormItem className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-3 space-y-0">
          <FormLabel className="text-muted-foreground">Members</FormLabel>
          <FormControl>{picker}</FormControl>
          <FormMessage className="col-start-2" />
        </FormItem>
      )}
    />
  );
}
