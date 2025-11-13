'use client';

import { useState } from 'react';
import { Button } from '@altitutor/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { ScrollArea } from '@altitutor/ui';
import { Plus } from 'lucide-react';
import type { Tables } from '@altitutor/shared';

interface SubjectSearchPopoverProps {
  allSubjects: Tables<'subjects'>[];
  selectedSubjects: Tables<'subjects'>[];
  onSelectSubject: (subject: Tables<'subjects'>) => void;
  trigger?: React.ReactNode;
  align?: 'start' | 'center' | 'end';
}

export function SubjectSearchPopover({
  allSubjects,
  selectedSubjects,
  onSelectSubject,
  trigger,
  align = 'end',
}: SubjectSearchPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSelectSubject = (subject: Tables<'subjects'>) => {
    onSelectSubject(subject);
    setIsOpen(false);
    setSearchQuery(''); // Reset search after selection
  };

  // Filter out already selected subjects
  const availableSubjects = allSubjects.filter(
    (s) => !selectedSubjects.some((ss) => ss.id === s.id)
  );

  // Filter subjects based on search query
  const filteredSubjects = availableSubjects.filter((subject) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const curriculum = (subject.curriculum || '').toLowerCase();
    const yearLevel = subject.year_level ? `year ${subject.year_level}` : '';
    const name = (subject.name || '').toLowerCase();
    const level = (subject.level || '').toLowerCase();

    return (
      curriculum.includes(query) ||
      yearLevel.includes(query) ||
      name.includes(query) ||
      level.includes(query)
    );
  });

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
              {filteredSubjects.length === 0 ? (
                <div className="p-3 text-center text-sm text-muted-foreground">
                  {searchQuery
                    ? 'No subjects match your search'
                    : 'No available subjects found'}
                </div>
              ) : (
                filteredSubjects.map((subject) => (
                  <Button
                    key={subject.id}
                    variant="ghost"
                    className="w-full justify-start h-auto p-3 hover:bg-accent hover:text-accent-foreground"
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










