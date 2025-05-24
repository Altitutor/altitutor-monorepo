import { useState } from 'react';
import { Class, Student, EnrollmentStatus } from "@/lib/supabase/db/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Users, Plus, X, Search, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface ClassStudentsTabProps {
  classData: Class;
  classStudents: Student[];
  allStudents: Student[];
  loadingStudents: boolean;
  onViewStudent: (studentId: string) => void;
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
  const router = useRouter();
  const [enrollingStudents, setEnrollingStudents] = useState<Set<string>>(new Set());
  const [removingStudents, setRemovingStudents] = useState<Set<string>>(new Set());
  const [isAddPopoverOpen, setIsAddPopoverOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleViewStudent = (studentId: string) => {
    // Close current modal and navigate to students page with student ID
    router.push(`/dashboard/students?view=${studentId}`);
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
      student.firstName.toLowerCase().includes(query) ||
      student.lastName.toLowerCase().includes(query) ||
      (student.studentEmail && student.studentEmail.toLowerCase().includes(query))
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
                            <div className="font-medium">{student.firstName} {student.lastName}</div>
                            {student.studentEmail && (
                              <div className="text-xs text-muted-foreground">{student.studentEmail}</div>
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
                              <div className="font-medium">{student.firstName} {student.lastName}</div>
                              {student.studentEmail && (
                                <div className="text-xs text-muted-foreground">{student.studentEmail}</div>
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
                      {student.firstName} {student.lastName}
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
              .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`))
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
                    {student.firstName} {student.lastName}
                  </div>
                  {student.studentEmail && (
                    <div className="text-xs text-muted-foreground">{student.studentEmail}</div>
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
    </div>
  );
} 