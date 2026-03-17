'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Button, SearchableSelect } from '@altitutor/ui';
import { Plus } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { subjectsApi } from '../api/subjects';

interface SubjectSearchPopoverProps {
  selectedSubjects: Tables<'subjects'>[];
  onSelectSubject: (subject: Tables<'subjects'>) => void;
  trigger?: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  initialSubjects?: Tables<'subjects'>[];
}

export function SubjectSearchPopover({
  selectedSubjects,
  onSelectSubject,
  trigger,
  align = 'end',
  initialSubjects = [],
}: SubjectSearchPopoverProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Tables<'subjects'>[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [open, setOpen] = useState(false);

  const initialSubjectsRef = useRef(initialSubjects);
  useEffect(() => {
    initialSubjectsRef.current = initialSubjects;
  }, [initialSubjects]);

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      if (searchQuery.trim().length === 0) {
        const currentInitialSubjects = initialSubjectsRef.current;
        if (currentInitialSubjects.length > 0) {
          setSearchResults(currentInitialSubjects);
          setIsSearching(false);
        } else {
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

  const availableSubjects = useMemo(() => {
    const selectedIds = new Set(selectedSubjects.map((s) => s.id));
    return searchResults.filter((s) => !selectedIds.has(s.id));
  }, [searchResults, selectedSubjects]);

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="flex items-center gap-2">
      <Plus className="h-4 w-4" />
      <span>Add Subject</span>
    </Button>
  );

  return (
    <SearchableSelect<Tables<'subjects'>>
      items={availableSubjects}
      value={null}
      onValueChange={(subject) => subject && onSelectSubject(subject)}
      getItemId={(s) => s.id}
      getItemLabel={(s) =>
        `${s.curriculum ?? ''} ${s.year_level ? `Year ${s.year_level}` : ''} ${s.name ?? ''}`.trim()
      }
      getItemValue={(s) =>
        `${s.curriculum ?? ''} ${s.year_level ?? ''} ${s.name ?? ''} ${s.long_name ?? ''}`.trim()
      }
      placeholder="Add subject"
      searchPlaceholder="Search subjects..."
      emptyMessage={
        searchQuery
          ? 'No subjects match your search'
          : 'No available subjects found'
      }
      trigger={trigger ?? defaultTrigger}
      loading={isSearching}
      align={align}
      contentWidth="400px"
      onSearchChange={setSearchQuery}
      open={open}
      onOpenChange={setOpen}
      renderItem={(subject) => (
        <div className="flex flex-col items-start w-full">
          <span className="font-medium">
            {subject.curriculum}{' '}
            {subject.year_level ? `Year ${subject.year_level}` : ''}{' '}
            {subject.name}
          </span>
          {subject.level && (
            <span className="text-xs text-muted-foreground">
              {subject.level}
            </span>
          )}
        </div>
      )}
    />
  );
}
