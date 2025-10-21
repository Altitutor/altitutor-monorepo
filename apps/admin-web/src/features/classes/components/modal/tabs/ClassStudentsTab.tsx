import { useState } from 'react';
import type { Tables } from '@altitutor/shared';
import { Button } from "@altitutor/ui";
import { Input } from "@altitutor/ui";
import { ScrollArea } from "@altitutor/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@altitutor/ui";
import { Loader2, Users, Plus, X, Search, Check } from "lucide-react";
import { cn } from "@/shared/utils";
import { ViewStudentModal } from '@/features/students';

interface ClassStudentsTabProps {
  classData: Tables<'classes'>;
  classStudents: Tables<'students'>[];
  allStudents: Tables<'students'>[];
  loadingStudents: boolean;
  onViewStudent?: (studentId: string) => void;
  onEnrollStudent: (studentId: string) => void;
  onRemoveStudent: (studentId: string) => void;
}

export function ClassStudentsTab({
  classData,
  classStudents,
  allStudents,
  loadingStudents,
  onViewStudent,
  onEnrollStudent,
  onRemoveStudent
}: ClassStudentsTabProps) {
  const [enrollingStudents, setEnrollingStudents] = useState<Set<string>>(new Set());
  const [removingStudents, setRemovingStudents] = useState<Set<string>>(new Set());
  const [isAddPopoverOpen, setIsAddPopoverOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state for student viewing
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);

  const handleViewStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setIsStudentModalOpen(true);
  };

  const handleEnrollStudent = async (studentId: string) => {
    setEnrollingStudents(prev => new Set(prev).add(studentId));
    setIsAddPopoverOpen(false); // Close the popover immediately for better UX
    
    try {
      await onEnrollStudent(studentId);
    } finally {
      setEnrollingStudents(prev => {
        const newSet = new Set(prev);
        newSet.delete(studentId);
        return newSet;
      });
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    setRemovingStudents(prev => new Set(prev).add(studentId));
    
    try {
      await onRemoveStudent(studentId);
    } finally {
      setRemovingStudents(prev => {
        const newSet = new Set(prev);
        newSet.delete(studentId);
        return newSet;
      });
    }
  };

  const availableStudents = allStudents.filter(student => 
    !classStudents.some(classStudent => classStudent.id === student.id)
  );

  const filteredAvailableStudents = availableStudents.filter(student => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      student.first_name.toLowerCase().includes(query) ||
      student.last_name.toLowerCase().includes(query) ||
      (student.student_email && student.student_email.toLowerCase().includes(query))
    );
  });

  return (
    <div className="flex-1 h-[calc(100vh-300px)] flex flex-col space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-medium">Students ({classStudents.length})</h3>
        
        {/* Show currently enrolling students */}
        {enrollingStudents.size > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Adding {enrollingStudents.size} student{enrollingStudents.size > 1 ? 's' : ''}...</span>
          </div>
        )}
        
        <Popover open={isAddPopoverOpen} onOpenChange={setIsAddPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>Add Student</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[300px]" align="end">
            <div className="p-3">
              <Input
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mb-3"
              />
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-1">
                  {filteredAvailableStudents.length === 0 ? (
                    <div className="p-3 text-center text-sm text-muted-foreground">
                      {searchQuery ? 'No students match your search' : 'No available students found'}
                    </div>
                  ) : (
                    filteredAvailableStudents.map(student => (
                      <Button
                        key={student.id}
                        variant="ghost"
                        className="w-full justify-start h-auto p-2 hover:bg-accent hover:text-accent-foreground"
                        onClick={() => handleEnrollStudent(student.id)}
                        disabled={enrollingStudents.has(student.id)}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex flex-col items-start">
                            <div className="font-medium">{student.first_name} {student.last_name}</div>
                            {student.student_email && (
                              <div className="text-xs text-muted-foreground">{student.student_email}</div>
                            )}
                          </div>
                          {enrollingStudents.has(student.id) && (
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
      
      {loadingStudents ? (
        <div className="flex-1 flex justify-center items-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : classStudents.length === 0 && enrollingStudents.size === 0 ? (
        <div className="flex-1 flex flex-col justify-center items-center">
          <Users className="h-12 w-12 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-4">No students enrolled</p>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Enroll a student
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[300px]" align="center">
              <div className="p-3">
                <Input
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mb-3"
                />
                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-1">
                    {filteredAvailableStudents.length === 0 ? (
                      <div className="p-3 text-center text-sm text-muted-foreground">
                        No students found
                      </div>
                    ) : (
                      filteredAvailableStudents.map(student => (
                        <Button
                          key={student.id}
                          variant="ghost"
                          className="w-full justify-start h-auto p-2 hover:bg-accent hover:text-accent-foreground"
                          onClick={() => handleEnrollStudent(student.id)}
                          disabled={enrollingStudents.has(student.id)}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex flex-col items-start">
                      <div className="font-medium">{student.first_name} {student.last_name}</div>
                      {student.student_email && (
                              <div className="text-xs text-muted-foreground">{student.student_email}</div>
                            )}
                            </div>
                            {enrollingStudents.has(student.id) && (
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
            {/* Show currently enrolling students at the top */}
            {Array.from(enrollingStudents).map(studentId => {
              const student = allStudents.find(s => s.id === studentId);
              if (!student) return null;
              
              return (
                <div 
                  key={`enrolling-${student.id}`}
                  className="flex items-center justify-between p-3 rounded-md border border-dashed bg-muted/50"
                >
                  <div className="flex-1">
                    <div className="font-medium text-muted-foreground">
                      {student.first_name} {student.last_name}
                    </div>
                    <div className="text-xs text-muted-foreground">Enrolling...</div>
                  </div>
                  
                  <div className="flex space-x-1">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              );
            })}
            
            {/* Show enrolled students */}
            {classStudents
              .sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`))
              .map((student) => (
              <div 
                key={student.id} 
                className={cn(
                  "flex items-center justify-between p-3 rounded-md border",
                  removingStudents.has(student.id) && "opacity-50"
                )}
              >
                <div className="flex-1">
                  <div className="font-medium">
                    {student.first_name} {student.last_name}
                  </div>
                  {student.student_email && (
                    <div className="text-xs text-muted-foreground">{student.student_email}</div>
                  )}
                </div>
                
                <div className="flex space-x-1">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleViewStudent(student.id)}
                    title="View Student"
                    disabled={removingStudents.has(student.id)}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleRemoveStudent(student.id)}
                    title="Remove Student"
                    disabled={removingStudents.has(student.id)}
                  >
                    {removingStudents.has(student.id) ? (
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
      
      {/* Student Modal */}
      {selectedStudentId && (
        <ViewStudentModal
          studentId={selectedStudentId}
          isOpen={isStudentModalOpen}
          onClose={() => {
            setIsStudentModalOpen(false);
            setSelectedStudentId(null);
          }}
          onStudentUpdated={() => {
            // Refresh would be handled by parent component
            // since we don't have direct access to refresh function here
          }}
        />
      )}
    </div>
  );
} 