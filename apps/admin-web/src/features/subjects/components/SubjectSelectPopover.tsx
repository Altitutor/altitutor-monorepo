'use client';

import { useState, useEffect } from 'react';
import { Button } from '@altitutor/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { ScrollArea } from '@altitutor/ui';
import { Loader2, Check } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { subjectsApi } from '../api/subjects';

interface SubjectSelectPopoverProps {
  selectedSubject: Tables<'subjects'> | null;
  onSelectSubject: (subject: Tables<'subjects'> | null) => void;
  trigger?: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  placeholder?: string;
}

export function SubjectSelectPopover({
  selectedSubject,
  onSelectSubject,
  trigger,
  align = 'end',
  placeholder = 'Select subject',
}: SubjectSelectPopoverProps) {
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
        // If no search query, get all subjects (first page)
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
  }, [searchQuery, isOpen]);

  const handleSelectSubject = (subject: Tables<'subjects'> | null) => {
    onSelectSubject(subject);
    setIsOpen(false);
    setSearchQuery('');
  };

  const defaultTrigger = (
    <Button variant="outline" className="w-full justify-start">
      {selectedSubject?.long_name ?? placeholder}
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
              <Button
                variant="ghost"
                className="w-full justify-start h-auto p-3"
                onClick={() => handleSelectSubject(null)}
              >
                <div className="flex items-center gap-2 w-full">
                  {!selectedSubject && <Check className="h-4 w-4" />}
                  <span className={!selectedSubject ? 'font-medium' : ''}>None</span>
                </div>
              </Button>
              {isSearching ? (
                <div className="p-3 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-3 text-center text-sm text-muted-foreground">
                  {searchQuery
                    ? 'No subjects match your search'
                    : 'No subjects found'}
                </div>
              ) : (
                searchResults.map((subject) => (
                  <Button
                    key={subject.id}
                    variant="ghost"
                    className="w-full justify-start h-auto p-3"
                    onClick={() => handleSelectSubject(subject)}
                  >
                    <div className="flex items-center gap-2 w-full">
                      {selectedSubject?.id === subject.id && <Check className="h-4 w-4" />}
                      <div className="flex flex-col items-start flex-1">
                        <div className={selectedSubject?.id === subject.id ? 'font-medium' : ''}>
                          {subject?.long_name ?? ''}
                        </div>
                        {subject.level && (
                          <div className="text-xs text-muted-foreground">
                            {subject.level}
                          </div>
                        )}
                      </div>
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
