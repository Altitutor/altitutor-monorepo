'use client';

import { Separator } from "@altitutor/ui";
import type { Tables } from "@altitutor/shared";
import { StudentCard } from '@/shared/components/StudentCard';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { studentsApi } from '../../api/students';

interface ParentDetailsTabProps {
  parent: Tables<'parents'>;
  studentIds: string[];
  students: Tables<'students'>[];
  onViewStudent?: (studentId: string) => void;
}

export function ParentDetailsTab({
  parent,
  studentIds,
  students,
  onViewStudent
}: ParentDetailsTabProps) {
  // Fetch subjects for all students in a single query
  const { data: detailsData, isLoading } = useQuery({
    queryKey: ['parent-students-subjects', studentIds.sort().join(',')],
    queryFn: () => studentsApi.getDetailsForStudentIds(studentIds),
    enabled: studentIds.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const studentSubjects = detailsData?.studentSubjects || {};

  return (
    <div className="space-y-6 pb-6 flex-1 overflow-y-auto px-1">
      {/* Parent Information Section */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Parent Information</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div className="text-sm font-medium">Email:</div>
          <div>{parent.email || '-'}</div>
          
          <div className="text-sm font-medium">Phone:</div>
          <div>{parent.phone || '-'}</div>
        </div>
      </div>

      <Separator className="my-6" />

      {/* Students Section */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Students</h3>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : students.length > 0 ? (
          <div className="space-y-2">
            {students.map((student) => (
              <StudentCard
                key={student.id}
                student={student}
                subjects={studentSubjects[student.id] || []}
                onClick={() => onViewStudent?.(student.id)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No students associated with this parent</p>
        )}
      </div>
    </div>
  );
}

