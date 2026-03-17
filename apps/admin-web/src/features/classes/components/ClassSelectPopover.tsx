'use client';

import { useState, useEffect } from 'react';
import { SearchableSelect } from '@altitutor/ui';
import { Check } from 'lucide-react';
import { classesApi } from '../api/classes';
import type { MinimalClass } from '../api/classes';

interface ClassSelectPopoverProps {
  selectedClass: MinimalClass | null;
  onSelectClass: (cls: MinimalClass | null) => void;
  subjectId: string | null;
  trigger?: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  placeholder?: string;
  disabled?: boolean;
}

export function ClassSelectPopover({
  selectedClass,
  onSelectClass,
  subjectId,
  trigger,
  align = 'end',
  placeholder = 'Select class',
  disabled = false,
}: ClassSelectPopoverProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MinimalClass[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { classes } = await classesApi.listMinimal({
          search: searchQuery.trim().length > 0 ? searchQuery.trim() : undefined,
          subjectIds: subjectId ? [subjectId] : undefined,
          limit: 100,
          offset: 0,
        });
        setSearchResults(classes);
      } catch (error) {
        console.error('Error searching classes:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, open, subjectId]);

  const emptyMessage = !subjectId
    ? 'Select a subject first'
    : searchQuery
      ? 'No classes match your search'
      : 'No classes found';

  return (
    <SearchableSelect<MinimalClass>
      items={searchResults}
      value={selectedClass}
      onValueChange={onSelectClass}
      getItemId={(c) => c.id}
      getItemLabel={(c) => c.long_name?.trim() ?? c.short_name ?? c.id}
      placeholder={placeholder}
      searchPlaceholder="Search classes..."
      emptyMessage={emptyMessage}
      trigger={trigger}
      disabled={disabled}
      allowClear
      loading={isSearching}
      align={align}
      contentWidth="400px"
      onSearchChange={setSearchQuery}
      open={open}
      onOpenChange={setOpen}
      renderItem={(cls, isSelected) => (
        <>
          <Check
            className={
              isSelected ? 'h-4 w-4 flex-shrink-0 opacity-100' : 'h-4 w-4 flex-shrink-0 opacity-0'
            }
          />
          <span className={isSelected ? 'font-medium' : ''}>
            {cls.long_name?.trim() ?? cls.short_name ?? cls.id}
          </span>
        </>
      )}
    />
  );
}
