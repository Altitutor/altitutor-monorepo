'use client';

import { Input } from '@altitutor/ui';
import { ScrollArea } from '@altitutor/ui';
import { Loader2, Search } from 'lucide-react';
import { ClassCard } from '@/shared/components/ClassCard';
import type { ClassWithExpandedSubject } from '@altitutor/shared';

interface ChangeClassStep1SelectClassProps {
  isFetching: boolean;
  filteredClasses: ClassWithExpandedSubject[];
  selectedNewClassId: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectClass: (classId: string) => void;
}

export function ChangeClassStep1SelectClass({
  isFetching,
  filteredClasses,
  selectedNewClassId,
  searchQuery,
  onSearchChange,
  onSelectClass,
}: ChangeClassStep1SelectClassProps) {
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search classes..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <ScrollArea className="max-h-[calc(90vh-400px)] min-h-[200px]">
        {isFetching ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredClasses.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No alternative classes found for this subject
          </p>
        ) : (
          <div className="space-y-2 pr-4">
            {filteredClasses.map((c) => (
              <ClassCard
                key={c.id}
                class={c}
                subject={c.subject}
                staff={c.staff || []}
                students={c.students}
                isSelecting
                isSelected={selectedNewClassId === c.id}
                onClick={() => onSelectClass(c.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

