'use client';

import { useState } from 'react';
import { Button, SearchableSelect } from '@altitutor/ui';
import { Plus } from 'lucide-react';
import type { Tables } from '@altitutor/shared';

interface ParentSearchPopoverProps {
  allParents: Tables<'parents'>[];
  selectedParents: Tables<'parents'>[];
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

  const availableParents = allParents.filter(
    (p) => !selectedParents.some((sp) => sp.id === p.id)
  );

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="flex items-center gap-2">
      <Plus className="h-4 w-4" />
      <span>Add Parent</span>
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
      placeholder="Add parent"
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
      renderItem={(parent) => (
        <div className="flex flex-col items-start w-full">
          <span className="font-medium">
            {parent.first_name} {parent.last_name}
          </span>
          {parent.email && (
            <span className="text-xs text-muted-foreground">{parent.email}</span>
          )}
        </div>
      )}
      footer={
        onCreateNewParent ? (
          <Button
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
