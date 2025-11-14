'use client';

import { useState } from 'react';
import { Button } from '@altitutor/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { ScrollArea } from '@altitutor/ui';
import { Plus } from 'lucide-react';
import type { Tables } from '@altitutor/shared';

interface StudentSearchPopoverProps {
  allStudents: Tables<'students'>[];
  selectedStudents: Tables<'students'>[];
  onSelectStudent: (student: Tables<'students'>) => void;
  trigger?: React.ReactNode;
  align?: 'start' | 'center' | 'end';
}

export function StudentSearchPopover({
  allStudents,
  selectedStudents,
  onSelectStudent,
  trigger,
  align = 'end',
}: StudentSearchPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSelectStudent = (student: Tables<'students'>) => {
    onSelectStudent(student);
    setIsOpen(false);
    setSearchQuery(''); // Reset search after selection
  };

  // Filter out already selected students
  const availableStudents = allStudents.filter(
    (s) => !selectedStudents.some((ss) => ss.id === s.id)
  );

  // Filter students based on search query
  const filteredStudents = availableStudents.filter((student) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const firstName = (student.first_name || '').toLowerCase();
    const lastName = (student.last_name || '').toLowerCase();
    const school = (student.school || '').toLowerCase();
    const email = (student.email || '').toLowerCase();

    return (
      firstName.includes(query) ||
      lastName.includes(query) ||
      school.includes(query) ||
      email.includes(query) ||
      `${firstName} ${lastName}`.includes(query)
    );
  });

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="flex items-center gap-2">
      <Plus className="h-4 w-4" />
      <span>Add Student</span>
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
            placeholder="Search students..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mb-3"
          />
          <ScrollArea className="h-[300px]">
            <div className="space-y-1 pr-4">
              {filteredStudents.length === 0 ? (
                <div className="p-3 text-center text-sm text-muted-foreground">
                  {searchQuery
                    ? 'No students match your search'
                    : 'No available students found'}
                </div>
              ) : (
                filteredStudents.map((student) => (
                  <Button
                    key={student.id}
                    variant="ghost"
                    className="w-full justify-start h-auto p-3"
                    onClick={() => handleSelectStudent(student)}
                  >
                    <div className="flex flex-col items-start w-full">
                      <div className="font-medium">
                        {student.first_name} {student.last_name}
                      </div>
                      {student.school && (
                        <div className="text-xs text-muted-foreground">
                          {student.school}
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


