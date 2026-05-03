import { useState } from 'react';
import type { Tables } from "@altitutor/shared";
import { Button, SearchableSelect, ScrollArea } from "@altitutor/ui";
import { Loader2, BookOpen, Plus, X, Search } from "lucide-react";
import { formatSubjectDisplay } from "@/shared/utils";
import { cn } from "@/shared/utils";
// import { ViewSubjectModal } from '@/features/subjects'; // Tutors can't view subjects modal - removed

interface SubjectsTabProps {
  staffMember: Tables<'staff'>;
  staffSubjects: Tables<'subjects'>[];
  allSubjects: Tables<'subjects'>[];
  loadingSubjects: boolean;
  onViewSubject?: (subjectId: string) => void;
  onAssignSubject: (subjectId: string) => void;
  onRemoveSubject: (subjectId: string) => void;
}

export function SubjectsTab({
  staffMember: _staffMember,
  staffSubjects,
  allSubjects,
  loadingSubjects,
  onViewSubject: _onViewSubject,
  onAssignSubject,
  onRemoveSubject
}: SubjectsTabProps) {
  const [assigningSubjects, setAssigningSubjects] = useState<Set<string>>(new Set());
  const [removingSubjects, setRemovingSubjects] = useState<Set<string>>(new Set());

  const handleAssignSubject = async (subjectId: string) => {
    setAssigningSubjects(prev => new Set(prev).add(subjectId));

    try {
      await onAssignSubject(subjectId);
    } finally {
      setAssigningSubjects(prev => {
        const newSet = new Set(prev);
        newSet.delete(subjectId);
        return newSet;
      });
    }
  };

  const handleRemoveSubject = async (subjectId: string) => {
    setRemovingSubjects(prev => new Set(prev).add(subjectId));

    try {
      await onRemoveSubject(subjectId);
    } finally {
      setRemovingSubjects(prev => {
        const newSet = new Set(prev);
        newSet.delete(subjectId);
        return newSet;
      });
    }
  };

  const handleViewSubject = (_subjectId: string) => {
    // Subject viewing modal removed for tutors
  };

  const availableSubjects = allSubjects.filter(subject =>
    !staffSubjects.some(staffSubject => staffSubject.id === subject.id)
  );

  const addSubjectTrigger = (
    <Button variant="outline" size="sm" className="ml-auto flex items-center gap-2">
      <Plus className="h-4 w-4" />
      <span>Add Subject</span>
    </Button>
  );

  const assignSubjectTrigger = (
    <Button variant="outline">
      <Plus className="h-4 w-4 mr-2" />
      Assign a subject
    </Button>
  );

  const subjectSelectProps = {
    items: availableSubjects,
    value: null as Tables<'subjects'> | null,
    onValueChange: (subject: Tables<'subjects'> | null) => subject && handleAssignSubject(subject.id),
    getItemId: (s: Tables<'subjects'>) => s.id,
    getItemLabel: formatSubjectDisplay,
    searchPlaceholder: "Search subjects...",
    emptyMessage: "No available subjects found",
    contentWidth: "300px",
    getItemDisabled: (s: Tables<'subjects'>) => assigningSubjects.has(s.id),
    renderItem: (subject: Tables<'subjects'>) => (
      <div className="flex items-center justify-between w-full">
        <span className="font-medium">{formatSubjectDisplay(subject)}</span>
        {assigningSubjects.has(subject.id) && (
          <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
        )}
      </div>
    ),
  };

  return (
    <div className="flex-1 h-[calc(100dvh-300px)] flex flex-col space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-medium">Subjects ({staffSubjects.length})</h3>

        {/* Show currently assigning subjects */}
        {assigningSubjects.size > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Adding {assigningSubjects.size} subject{assigningSubjects.size > 1 ? 's' : ''}...</span>
          </div>
        )}

        <SearchableSelect<Tables<'subjects'>>
          {...subjectSelectProps}
          trigger={addSubjectTrigger}
          align="end"
        />
      </div>

      {loadingSubjects ? (
        <div className="flex-1 flex justify-center items-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : staffSubjects.length === 0 && assigningSubjects.size === 0 ? (
        <div className="flex-1 flex flex-col justify-center items-center">
          <BookOpen className="h-12 w-12 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-4">No subjects assigned</p>
          <SearchableSelect<Tables<'subjects'>>
            {...subjectSelectProps}
            trigger={assignSubjectTrigger}
            align="center"
            emptyMessage="No subjects found"
          />
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-2">
            {/* Show currently assigning subjects at the top */}
            {Array.from(assigningSubjects).map(subjectId => {
              const subject = allSubjects.find(s => s.id === subjectId);
              if (!subject) return null;
              
              return (
                <div 
                  key={`assigning-${subject.id}`}
                  className="flex items-center justify-between p-2 rounded-md border border-dashed bg-muted/50"
                >
                  <div className="flex-1">
                    <div className="font-medium text-muted-foreground">
                      {formatSubjectDisplay(subject)}
                    </div>
                    <div className="text-xs text-muted-foreground">Adding...</div>
                  </div>
                  
                  <div className="flex space-x-1">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              );
            })}
            
            {/* Show assigned subjects */}
            {staffSubjects
              .sort((a, b) => formatSubjectDisplay(a).localeCompare(formatSubjectDisplay(b)))
              .map((subject) => (
              <div 
                key={subject.id} 
                className={cn(
                  "flex items-center justify-between p-2 rounded-md",
                  removingSubjects.has(subject.id) && "opacity-50"
                )}
              >
                <div className="flex-1">
                  <div className="font-medium">{formatSubjectDisplay(subject)}</div>
                </div>
                
                <div className="flex space-x-1">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleViewSubject(subject.id)}
                    title="View Subject"
                    disabled={removingSubjects.has(subject.id)}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleRemoveSubject(subject.id)}
                    title="Remove Subject"
                    disabled={removingSubjects.has(subject.id)}
                  >
                    {removingSubjects.has(subject.id) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
      
      {/* Subject Modal - removed for tutors */}
      {/* {selectedSubjectId && (
        <ViewSubjectModal
          subjectId={selectedSubjectId}
          isOpen={isSubjectModalOpen}
          onClose={() => {
            setIsSubjectModalOpen(false);
            setSelectedSubjectId(null);
          }}
          onSubjectUpdated={() => {
            // Refresh would be handled by parent component
            // since we don't have direct access to refresh function here
          }}
        />
      )} */}
    </div>
  );
} 