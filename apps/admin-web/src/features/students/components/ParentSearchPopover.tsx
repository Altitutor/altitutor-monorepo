'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, SearchableSelect } from '@altitutor/ui';
import { Plus } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { parentsApi } from '@/features/parents/api/parents';
import { useDebounce } from '@/shared/hooks/useDebounce';

interface ParentSearchPopoverProps {
  allParents?: Tables<'parents'>[];
  selectedParents: Array<{ id: string }>;
  onSelectParent: (parent: Tables<'parents'>) => void;
  onCreateNewParent?: () => void;
  trigger?: React.ReactNode;
  align?: 'start' | 'center' | 'end';
}

export function ParentSearchPopover({
  allParents,
  selectedParents,
  onSelectParent,
  onCreateNewParent,
  trigger,
  align = 'end',
}: ParentSearchPopoverProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const useServerSearch = allParents === undefined;

  const { data, isFetching } = useQuery({
    queryKey: ['parent-search-popover', debouncedSearch],
    queryFn: () =>
      parentsApi.list({
        search: debouncedSearch,
        limit: 20,
        offset: 0,
        orderBy: 'last_name',
        ascending: true,
      }),
    enabled: useServerSearch && open,
    staleTime: 20_000,
  });

  const selectedIds = new Set(selectedParents.map((parent) => parent.id));
  const sourceParents = useServerSearch ? (data?.parents ?? []) : (allParents ?? []);
  const availableParents = sourceParents.filter((parent) => !selectedIds.has(parent.id));

  const defaultTrigger = (
    <Button type="button" variant="outline" size="sm" className="flex items-center gap-2">
      <Plus className="h-4 w-4" />
      <span>Link existing</span>
    </Button>
  );

  return (
    <SearchableSelect<Tables<'parents'>>
      items={availableParents}
      value={null}
      onValueChange={(parent) => parent && onSelectParent(parent)}
      getItemId={(p) => p.id}
      getItemLabel={(p) => `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim()}
      getItemValue={(p) =>
        `${p.first_name ?? ''} ${p.last_name ?? ''} ${p.email ?? ''} ${p.phone ?? ''}`.trim()
      }
      placeholder="Search parents"
      searchPlaceholder="Search parents..."
      emptyMessage={
        availableParents.length === 0
          ? 'No available parents found'
          : 'No parents match your search'
      }
      trigger={trigger ?? defaultTrigger}
      align={align}
      contentWidth="400px"
      open={open}
      onOpenChange={setOpen}
      onSearchChange={useServerSearch ? setSearchQuery : undefined}
      loading={useServerSearch && isFetching}
      renderItem={(parent) => (
        <div className="flex flex-col items-start w-full">
          <span className="font-medium">
            {parent.first_name} {parent.last_name}
          </span>
          {parent.email && (
            <span className="text-xs text-muted-foreground">{parent.email}</span>
          )}
          {!parent.email && parent.phone && (
            <span className="text-xs text-muted-foreground">{parent.phone}</span>
          )}
        </div>
      )}
      footer={
        onCreateNewParent ? (
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start h-auto p-3 border-dashed"
            onClick={() => {
              setOpen(false);
              onCreateNewParent();
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            <span className="font-medium">Create new parent</span>
          </Button>
        ) : undefined
      }
    />
  );
}
