import { useState } from 'react';
import type { Tables } from '@altitutor/shared';
import { Button, SearchableSelect, ScrollArea } from "@altitutor/ui";
import { Loader2, Users, Plus, X, Search } from "lucide-react";
import { cn } from "@/shared/utils";
// import { ViewStudentModal } from '@/features/students'; // TODO: Tutor-web doesn't have students feature

interface ClassStudentsTabProps {
  classStudents: Tables<'students'>[];
  allStudents: Tables<'students'>[];
  loadingStudents: boolean;
  onEnrollStudent: (studentId: string) => void;
  onRemoveStudent: (studentId: string) => void;
}

export function ClassStudentsTab({
  classStudents,
  allStudents,
  loadingStudents,
  onEnrollStudent,
  onRemoveStudent
}: ClassStudentsTabProps) {
  const [enrollingStudents, setEnrollingStudents] = useState<Set<string>>(new Set());
  const [removingStudents, setRemovingStudents] = useState<Set<string>>(new Set());

  const handleViewStudent = (_studentId: string) => {
    // View student functionality removed for tutors
  };

  const handleEnrollStudent = async (studentId: string) => {
    setEnrollingStudents(prev => new Set(prev).add(studentId));

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

  const getStudentLabel = (student: Tables<'students'>) =>
    `${student.first_name} ${student.last_name}`;

  const addStudentTrigger = (
    <Button variant="outline" size="sm" className="ml-auto flex items-center gap-2">
      <Plus className="h-4 w-4" />
      <span>Add Student</span>
    </Button>
  );

  const enrollStudentTrigger = (
    <Button variant="outline">
      <Plus className="h-4 w-4 mr-2" />
      Enroll a student
    </Button>
  );

  const studentSelectProps = {
    items: availableStudents,
    value: null as Tables<'students'> | null,
    onValueChange: (student: Tables<'students'> | null) =>
      student && handleEnrollStudent(student.id),
    getItemId: (s: Tables<'students'>) => s.id,
    getItemLabel: getStudentLabel,
    getItemValue: (s: Tables<'students'>) =>
      `${s.first_name} ${s.last_name} ${s.email ?? ''}`.toLowerCase(),
    searchPlaceholder: "Search students...",
    emptyMessage: "No available students found",
    contentWidth: "300px",
    getItemDisabled: (s: Tables<'students'>) => enrollingStudents.has(s.id),
    renderItem: (student: Tables<'students'>) => (
      <div className="flex items-center justify-between w-full">
        <div className="flex flex-col items-start">
          <div className="font-medium">{getStudentLabel(student)}</div>
          {student.email && (
            <div className="text-xs text-muted-foreground">{student.email}</div>
          )}
        </div>
        {enrollingStudents.has(student.id) && (
          <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
        )}
      </div>
    ),
  };

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

        <SearchableSelect<Tables<'students'>>
          {...studentSelectProps}
          trigger={addStudentTrigger}
          align="end"
        />
      </div>

      {loadingStudents ? (
        <div className="flex-1 flex justify-center items-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : classStudents.length === 0 && enrollingStudents.size === 0 ? (
        <div className="flex-1 flex flex-col justify-center items-center">
          <Users className="h-12 w-12 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-4">No students enrolled</p>
          <SearchableSelect<Tables<'students'>>
            {...studentSelectProps}
            trigger={enrollStudentTrigger}
            align="center"
            emptyMessage="No students found"
          />
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
                  {student.email && (
                    <div className="text-xs text-muted-foreground">{student.email}</div>
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
      
      {/* Student Modal - TODO: Tutor-web doesn't have students feature */}
      {/* {selectedStudentId && (
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
      )} */}
    </div>
  );
} 