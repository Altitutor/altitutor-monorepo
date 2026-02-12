'use client';

import { useState } from 'react';
import { Button } from '@altitutor/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { ScrollArea } from '@altitutor/ui';
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
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSelectParent = (parent: Tables<'parents'>) => {
    onSelectParent(parent);
    setIsOpen(false);
    setSearchQuery(''); // Reset search after selection
  };

  // Filter out already selected parents
  const availableParents = allParents.filter(
    (p) => !selectedParents.some((sp) => sp.id === p.id)
  );

  // Filter parents based on search query
  const filteredParents = availableParents.filter((parent) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const firstName = (parent.first_name || '').toLowerCase();
    const lastName = (parent.last_name || '').toLowerCase();
    const email = (parent.email || '').toLowerCase();
    const phone = (parent.phone || '').toLowerCase();

    return (
      firstName.includes(query) ||
      lastName.includes(query) ||
      email.includes(query) ||
      phone.includes(query) ||
      `${firstName} ${lastName}`.includes(query)
    );
  });

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="flex items-center gap-2">
      <Plus className="h-4 w-4" />
      <span>Add Parent</span>
    </Button>
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {trigger || defaultTrigger}
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[400px]" align={align}>
        <div className="p-3">
          <Input
            placeholder="Search parents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mb-3"
          />
          <ScrollArea className="h-[300px]">
            <div className="space-y-1 pr-4">
              {filteredParents.length === 0 ? (
                <div className="space-y-2">
                  <div className="p-3 text-center text-sm text-muted-foreground">
                    {searchQuery
                      ? 'No parents match your search'
                      : 'No available parents found'}
                  </div>
                  {searchQuery && onCreateNewParent && (
                    <Button
                      variant="outline"
                      className="w-full justify-start h-auto p-3 border-dashed"
                      onClick={() => {
                        setIsOpen(false);
                        onCreateNewParent();
                      }}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Plus className="h-4 w-4" />
                        <span className="font-medium">Create new parent</span>
                      </div>
                    </Button>
                  )}
                </div>
              ) : (
                filteredParents.map((parent) => (
                  <Button
                    key={parent.id}
                    variant="ghost"
                    className="w-full justify-start h-auto p-3"
                    onClick={() => handleSelectParent(parent)}
                  >
                    <div className="flex flex-col items-start w-full">
                      <div className="font-medium">
                        {parent.first_name} {parent.last_name}
                      </div>
                      {parent.email && (
                        <div className="text-xs text-muted-foreground">
                          {parent.email}
                        </div>
                      )}
                    </div>
                  </Button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}


