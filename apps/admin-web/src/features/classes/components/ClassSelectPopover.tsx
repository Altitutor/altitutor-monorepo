'use client';

import { useState, useEffect } from 'react';
import { Button } from '@altitutor/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { ScrollArea } from '@altitutor/ui';
import { Loader2, Check } from 'lucide-react';
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
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MinimalClass[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!isOpen) {
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
  }, [searchQuery, isOpen, subjectId]);

  const handleSelectClass = (cls: MinimalClass | null) => {
    onSelectClass(cls);
    setIsOpen(false);
    setSearchQuery('');
  };

  const defaultTrigger = (
    <Button variant="outline" className="w-full justify-start" disabled={disabled}>
      {selectedClass?.long_name?.trim() ?? placeholder}
    </Button>
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {trigger ?? defaultTrigger}
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[400px]" align={align}>
        <div className="p-3">
          <Input
            placeholder="Search classes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mb-3"
          />
          <ScrollArea className="h-[300px]">
            <div className="space-y-1 pr-4">
              <Button
                variant="ghost"
                className="w-full justify-start h-auto p-3"
                onClick={() => handleSelectClass(null)}
              >
                <div className="flex items-center gap-2 w-full">
                  {!selectedClass && <Check className="h-4 w-4" />}
                  <span className={!selectedClass ? 'font-medium' : ''}>None</span>
                </div>
              </Button>
              {!subjectId ? (
                <div className="p-3 text-center text-sm text-muted-foreground">
                  Select a subject first
                </div>
              ) : isSearching ? (
                <div className="p-3 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-3 text-center text-sm text-muted-foreground">
                  {searchQuery ? 'No classes match your search' : 'No classes found'}
                </div>
              ) : (
                searchResults.map((cls) => (
                  <Button
                    key={cls.id}
                    variant="ghost"
                    className="w-full justify-start h-auto p-3"
                    onClick={() => handleSelectClass(cls)}
                  >
                    <div className="flex items-center gap-2 w-full">
                      {selectedClass?.id === cls.id && <Check className="h-4 w-4" />}
                      <span className={selectedClass?.id === cls.id ? 'font-medium' : ''}>
                        {cls.long_name?.trim() ?? cls.short_name ?? cls.id}
                      </span>
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
