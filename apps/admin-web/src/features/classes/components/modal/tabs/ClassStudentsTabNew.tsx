import { useState } from 'react';
import type { Tables } from '@altitutor/shared';
import { Button } from "@altitutor/ui";
import { ScrollArea } from "@altitutor/ui";
import { Loader2, Plus } from "lucide-react";
import { StudentCard } from '@/shared/components/StudentCard';
import { ViewStudentModal } from '@/features/students';

interface ClassStudentsTabNewProps {
  classData: Tables<'classes'>;
  classSubject?: Tables<'subjects'>;
  classStaff?: Tables<'staff'>[];
  classStudents: Array<Tables<'students'> & { 
    subjects?: Tables<'subjects'>[];
    enrollment?: any; // ClassEnrollmentWithAudit
  }>;
  loadingStudents: boolean;
  onAddStudent: () => void;
  onChangeClass: (studentId: string) => void;
  onUnenroll: (studentId: string) => void;
}

export function ClassStudentsTabNew({
  classData,
  classSubject,
  classStaff = [],
  classStudents,
  loadingStudents,
  onAddStudent,
  onChangeClass,
  onUnenroll
}: ClassStudentsTabNewProps) {
  // Modal state for student viewing
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);

  const handleViewStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setIsStudentModalOpen(true);
  };

  return (
    <div className="flex-1 h-[calc(100vh-300px)] flex flex-col space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-medium">Students ({classStudents.length})</h3>
        
        <Button 
          variant="outline" 
          size="sm" 
          className="ml-auto flex items-center gap-2"
          onClick={onAddStudent}
        >
          <Plus className="h-4 w-4" />
          <span>Add Student</span>
        </Button>
      </div>

      {loadingStudents ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : classStudents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground">No students enrolled in this class yet.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={onAddStudent}
          >
            <Plus className="h-4 w-4 mr-2" />
            Enroll First Student
          </Button>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-2">
            {classStudents.map((student) => (
              <StudentCard
                key={student.id}
                student={student}
                subjects={student.subjects}
                enrollment={student.enrollment}
                onClick={() => handleViewStudent(student.id)}
                onChangeClass={() => onChangeClass(student.id)}
                onUnenroll={() => onUnenroll(student.id)}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Student Modal */}
      {selectedStudentId && (
        <ViewStudentModal
          isOpen={isStudentModalOpen}
          onClose={() => setIsStudentModalOpen(false)}
          studentId={selectedStudentId}
          onStudentUpdated={() => {
            // Could refresh student data here
          }}
        />
      )}
    </div>
  );
}

