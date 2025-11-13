'use client';

import { useState } from 'react';
import type { Tables } from '@altitutor/shared';
import { ScrollArea } from "@altitutor/ui";
import { Loader2, Users } from "lucide-react";
import { StudentCard } from '@/shared/components/StudentCard';
import { ViewStudentModal } from '@/features/students';
import { useStaffStudents } from '../../../hooks/useStaffQuery';

interface StudentsTabProps {
  staffId: string;
  isOpen: boolean;
}

export function StudentsTab({
  staffId,
  isOpen
}: StudentsTabProps) {
  const { data, isLoading } = useStaffStudents(staffId, isOpen);
  
  const students = data?.students || [];
  const studentSubjects = data?.studentSubjects || {};
  
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);

  const handleViewStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setIsStudentModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex justify-center items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center">
        <Users className="h-12 w-12 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No students assigned to classes taught by this staff member</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-base font-medium">Students ({students.length})</h3>
        </div>
        
        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-2">
            {students
              .sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`))
              .map((student) => (
                <StudentCard
                  key={student.id}
                  student={student}
                  subjects={studentSubjects[student.id] || []}
                  onClick={() => handleViewStudent(student.id)}
                />
              ))}
          </div>
        </ScrollArea>
      </div>

      {/* Student Modal */}
      {selectedStudentId && (
        <ViewStudentModal
          isOpen={isStudentModalOpen}
          onClose={() => {
            setIsStudentModalOpen(false);
            setSelectedStudentId(null);
          }}
          studentId={selectedStudentId}
          onStudentUpdated={() => {
            // Refresh handled by query invalidation
          }}
        />
      )}
    </>
  );
}

