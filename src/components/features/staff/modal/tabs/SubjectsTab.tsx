import { useState } from 'react';
import { Staff, Subject } from "@/lib/supabase/db/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Loader2, BookOpen, Plus, X, Search } from "lucide-react";
import { formatSubjectDisplay } from "@/lib/utils";

interface SubjectsTabProps {
  staffMember: Staff;
  staffSubjects: Subject[];
  allSubjects: Subject[];
  loadingSubjects: boolean;
  onViewSubject: (subjectId: string) => void;
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
  return (
    <div className="flex-1 h-[calc(100vh-300px)] flex flex-col space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-medium">Subjects</h3>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>Add Subject</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[300px]" align="end">
            <Command>
              <CommandInput placeholder="Search subjects..." />
              <CommandList className="max-h-[300px]">
                <CommandEmpty>No subjects found.</CommandEmpty>
                <CommandGroup>
                  {allSubjects
                    .filter(subject => 
                      !staffSubjects.some(
                        staffSubject => staffSubject.id === subject.id
                      )
                    )
                    .map(subject => (
                      <CommandItem
                        key={subject.id}
                        value={formatSubjectDisplay(subject)}
                        onSelect={() => onAssignSubject(subject.id)}
                        className="cursor-pointer"
                      >
                        {formatSubjectDisplay(subject)}
                      </CommandItem>
                    ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      
      {loadingSubjects ? (
        <div className="flex-1 flex justify-center items-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : staffSubjects.length === 0 ? (
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
              <Command>
                <CommandInput placeholder="Search subjects..." />
                <CommandList className="max-h-[300px]">
                  <CommandEmpty>No subjects found.</CommandEmpty>
                  <CommandGroup>
                    {allSubjects.map(subject => (
                      <CommandItem
                        key={subject.id}
                        value={formatSubjectDisplay(subject)}
                        onSelect={() => onAssignSubject(subject.id)}
                        className="cursor-pointer"
                      >
                        {formatSubjectDisplay(subject)}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-2">
            {staffSubjects
              .sort((a, b) => formatSubjectDisplay(a).localeCompare(formatSubjectDisplay(b)))
              .map((subject) => (
              <div 
                key={subject.id} 
                className="flex items-center justify-between p-2 rounded-md"
              >
                <div className="flex-1">
                  <div className="font-medium">{formatSubjectDisplay(subject)}</div>
                </div>
                
                <div className="flex space-x-1">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onViewSubject(subject.id)}
                    title="View Subject"
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onRemoveSubject(subject.id)}
                    title="Remove Subject"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
} 