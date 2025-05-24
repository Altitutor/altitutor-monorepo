import { useState } from 'react';
import { Staff, Subject } from "@/lib/supabase/db/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, BookOpen, Plus, X, Search } from "lucide-react";
import { formatSubjectDisplay } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { ViewSubjectModal } from '@/components/features/subjects';

interface SubjectsTabProps {
  staffMember: Staff;
  staffSubjects: Subject[];
  allSubjects: Subject[];
  loadingSubjects: boolean;
  onViewSubject?: (subjectId: string) => void;
  onAssignSubject: (subjectId: string) => void;
  onRemoveSubject: (subjectId: string) => void;
}

export function SubjectsTab({
  staffMember,
  staffSubjects,
  allSubjects,
  loadingSubjects,
  onViewSubject,
  onAssignSubject,
  onRemoveSubject
}: SubjectsTabProps) {
  const [assigningSubjects, setAssigningSubjects] = useState<Set<string>>(new Set());
  const [removingSubjects, setRemovingSubjects] = useState<Set<string>>(new Set());
  const [isAddPopoverOpen, setIsAddPopoverOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state for subject viewing
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);

  const handleAssignSubject = async (subjectId: string) => {
    setAssigningSubjects(prev => new Set(prev).add(subjectId));
    setIsAddPopoverOpen(false); // Close the popover immediately for better UX
    
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

  const handleViewSubject = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setIsSubjectModalOpen(true);
  };

  const availableSubjects = allSubjects.filter(subject => 
    !staffSubjects.some(staffSubject => staffSubject.id === subject.id)
  );

  const filteredAvailableSubjects = availableSubjects.filter(subject => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return formatSubjectDisplay(subject).toLowerCase().includes(query);
  });

  return (
    <div className="flex-1 h-[calc(100vh-300px)] flex flex-col space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-medium">Subjects ({staffSubjects.length})</h3>
        
        {/* Show currently assigning subjects */}
        {assigningSubjects.size > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Adding {assigningSubjects.size} subject{assigningSubjects.size > 1 ? 's' : ''}...</span>
          </div>
        )}
        
        <Popover open={isAddPopoverOpen} onOpenChange={setIsAddPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>Add Subject</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[300px]" align="end">
            <div className="p-3">
              <Input
                placeholder="Search subjects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mb-3"
              />
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-1">
                  {filteredAvailableSubjects.length === 0 ? (
                    <div className="p-3 text-center text-sm text-muted-foreground">
                      {searchQuery ? 'No subjects match your search' : 'No available subjects found'}
                    </div>
                  ) : (
                    filteredAvailableSubjects.map(subject => (
                      <Button
                        key={subject.id}
                        variant="ghost"
                        className="w-full justify-start h-auto p-2 hover:bg-accent hover:text-accent-foreground"
                        onClick={() => handleAssignSubject(subject.id)}
                        disabled={assigningSubjects.has(subject.id)}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex flex-col items-start">
                            <div className="font-medium">{formatSubjectDisplay(subject)}</div>
                          </div>
                          {assigningSubjects.has(subject.id) && (
                            <Loader2 className="h-4 w-4 animate-spin" />
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
      </div>
      
      {loadingSubjects ? (
        <div className="flex-1 flex justify-center items-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : staffSubjects.length === 0 && assigningSubjects.size === 0 ? (
        <div className="flex-1 flex flex-col justify-center items-center">
          <BookOpen className="h-12 w-12 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-4">No subjects assigned</p>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Assign a subject
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[300px]" align="center">
              <div className="p-3">
                <Input
                  placeholder="Search subjects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mb-3"
                />
                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-1">
                    {filteredAvailableSubjects.length === 0 ? (
                      <div className="p-3 text-center text-sm text-muted-foreground">
                        No subjects found
                      </div>
                    ) : (
                      filteredAvailableSubjects.map(subject => (
                        <Button
                          key={subject.id}
                          variant="ghost"
                          className="w-full justify-start h-auto p-2 hover:bg-accent hover:text-accent-foreground"
                          onClick={() => handleAssignSubject(subject.id)}
                          disabled={assigningSubjects.has(subject.id)}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex flex-col items-start">
                              <div className="font-medium">{formatSubjectDisplay(subject)}</div>
                            </div>
                            {assigningSubjects.has(subject.id) && (
                              <Loader2 className="h-4 w-4 animate-spin" />
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
      
      {/* Subject Modal */}
      {selectedSubjectId && (
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
      )}
    </div>
  );
} 