'use client';

import { useState } from 'react';
import { Button, SearchableSelect } from '@altitutor/ui';
import { Plus } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { formatSubjectDisplay } from '@/shared/utils';

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
  const [open, setOpen] = useState(false);

  const availableSubjects = allSubjects.filter(
    (s) => !selectedSubjects.some((ss) => ss.id === s.id)
  );

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
      getItemLabel={formatSubjectDisplay}
      getItemValue={(s) =>
        `${s.curriculum ?? ''} ${s.year_level ?? ''} ${s.name ?? ''} ${s.level ?? ''}`.trim()
      }
      placeholder="Add subject"
      searchPlaceholder="Search subjects..."
      emptyMessage="No available subjects found"
      trigger={trigger ?? defaultTrigger}
      align={align}
      contentWidth="400px"
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
            <span className="text-xs text-muted-foreground">{subject.level}</span>
          )}
        </div>
      )}
    />
  );
}
