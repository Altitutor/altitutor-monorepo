'use client';

import { useState } from 'react';
import { Button, SearchableSelect } from '@altitutor/ui';
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
  const [open, setOpen] = useState(false);

  const availableStudents = allStudents.filter(
    (s) => !selectedStudents.some((ss) => ss.id === s.id)
  );

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="flex items-center gap-2">
      <Plus className="h-4 w-4" />
      <span>Add Student</span>
    </Button>
  );

  return (
    <SearchableSelect<Tables<'students'>>
      items={availableStudents}
      value={null}
      onValueChange={(student) => student && onSelectStudent(student)}
      getItemId={(s) => s.id}
      getItemLabel={(s) => `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim()}
      getItemValue={(s) =>
        `${s.first_name ?? ''} ${s.last_name ?? ''} ${s.school ?? ''} ${s.email ?? ''}`.trim()
      }
      placeholder="Add student"
      searchPlaceholder="Search students..."
      emptyMessage={
        availableStudents.length === 0
          ? 'No available students found'
          : 'No students match your search'
      }
      trigger={trigger ?? defaultTrigger}
      align={align}
      contentWidth="400px"
      open={open}
      onOpenChange={setOpen}
      renderItem={(student) => (
        <div className="flex flex-col items-start w-full">
          <span className="font-medium">
            {student.first_name} {student.last_name}
          </span>
          {student.school && (
            <span className="text-xs text-muted-foreground">{student.school}</span>
          )}
        </div>
      )}
    />
  );
}
