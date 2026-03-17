'use client';

import { useState, useEffect } from 'react';
import { SearchableSelect } from '@altitutor/ui';
import { Check } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { subjectsApi } from '../api/subjects';

interface SubjectSelectPopoverProps {
  selectedSubject: Tables<'subjects'> | null;
  onSelectSubject: (subject: Tables<'subjects'> | null) => void;
  trigger?: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  placeholder?: string;
  /** Show "None" option to clear selection. Default true. */
  allowClear?: boolean;
}

export function SubjectSelectPopover({
  selectedSubject,
  onSelectSubject,
  trigger,
  align = 'end',
  placeholder = 'Select subject',
  allowClear = true,
}: SubjectSelectPopoverProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Tables<'subjects'>[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      if (searchQuery.trim().length === 0) {
        setIsSearching(true);
        try {
          const { subjects } = await subjectsApi.list({ limit: 100, offset: 0 });
          setSearchResults(subjects);
        } catch (error) {
          console.error('Error fetching subjects:', error);
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      } else {
        setIsSearching(true);
        try {
          const { subjects } = await subjectsApi.list({
            search: searchQuery.trim(),
            limit: 100,
            offset: 0,
          });
          setSearchResults(subjects);
        } catch (error) {
          console.error('Error searching subjects:', error);
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, open]);

  return (
    <SearchableSelect<Tables<'subjects'>>
      items={searchResults}
      value={selectedSubject}
      onValueChange={onSelectSubject}
      getItemId={(s) => s.id}
      getItemLabel={(s) => s.long_name ?? ''}
      getItemValue={(s) => `${s.long_name ?? ''} ${s.level ?? ''}`.trim()}
      placeholder={placeholder}
      searchPlaceholder="Search subjects..."
      emptyMessage={
        searchQuery ? 'No subjects match your search' : 'No subjects found'
      }
      trigger={trigger}
      allowClear={allowClear}
      loading={isSearching}
      align={align}
      contentWidth="400px"
      onSearchChange={setSearchQuery}
      open={open}
      onOpenChange={setOpen}
      renderItem={(subject, isSelected) => (
        <>
          <Check
            className={
              isSelected ? 'h-4 w-4 flex-shrink-0 opacity-100' : 'h-4 w-4 flex-shrink-0 opacity-0'
            }
          />
          <div className="flex flex-col items-start flex-1">
            <span className={isSelected ? 'font-medium' : ''}>
              {subject.long_name ?? ''}
            </span>
            {subject.level && (
              <span className="text-xs text-muted-foreground">
                {subject.level}
              </span>
            )}
          </div>
        </>
      )}
    />
  );
}
