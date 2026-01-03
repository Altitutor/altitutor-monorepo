'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@altitutor/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { ScrollArea } from '@altitutor/ui';
import { Plus, Loader2 } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { subjectsApi } from '../api/subjects';

interface SubjectSearchPopoverProps {
  selectedSubjects: Tables<'subjects'>[];
  onSelectSubject: (subject: Tables<'subjects'>) => void;
  trigger?: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  initialSubjects?: Tables<'subjects'>[]; // Subjects to show initially when search is empty
}

export function SubjectSearchPopover({
  selectedSubjects,
  onSelectSubject,
  trigger,
  align = 'end',
  initialSubjects = [],
}: SubjectSearchPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Tables<'subjects'>[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Debounced server-side search
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      if (searchQuery.trim().length === 0) {
        // If no search query and initialSubjects provided, use those; otherwise get all subjects
        if (initialSubjects.length > 0) {
          setSearchResults(initialSubjects);
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
        // Search with query
        setIsSearching(true);
        try {
          const { subjects } = await subjectsApi.list({ 
            search: searchQuery.trim(), 
            limit: 100, 
            offset: 0 
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
  }, [searchQuery, isOpen, initialSubjects]);

  const handleSelectSubject = (subject: Tables<'subjects'>) => {
    onSelectSubject(subject);
    setIsOpen(false);
    setSearchQuery(''); // Reset search after selection
  };

  // Filter out already selected subjects
  const availableSubjects = useMemo(() => {
    const selectedIds = new Set(selectedSubjects.map(s => s.id));
    return searchResults.filter(s => !selectedIds.has(s.id));
  }, [searchResults, selectedSubjects]);

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="flex items-center gap-2">
      <Plus className="h-4 w-4" />
      <span>Add Subject</span>
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
            placeholder="Search subjects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mb-3"
          />
          <ScrollArea className="h-[300px]">
            <div className="space-y-1 pr-4">
              {isSearching ? (
                <div className="p-3 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching...
                </div>
              ) : availableSubjects.length === 0 ? (
                <div className="p-3 text-center text-sm text-muted-foreground">
                  {searchQuery
                    ? 'No subjects match your search'
                    : 'No available subjects found'}
                </div>
              ) : (
                availableSubjects.map((subject) => (
                  <Button
                    key={subject.id}
                    variant="ghost"
                    className="w-full justify-start h-auto p-3"
                    onClick={() => handleSelectSubject(subject)}
                  >
                    <div className="flex flex-col items-start w-full">
                      <div className="font-medium">
                        {subject.curriculum}{' '}
                        {subject.year_level ? `Year ${subject.year_level}` : ''}{' '}
                        {subject.name}
                      </div>
                      {subject.level && (
                        <div className="text-xs text-muted-foreground">
                          {subject.level}
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










