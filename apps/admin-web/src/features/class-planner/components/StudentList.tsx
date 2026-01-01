'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import { Card } from '@altitutor/ui';
import { Search } from 'lucide-react';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { studentsApi } from '@/features/students/api/students';
import { formatSubjectDisplay, getSubjectColorStyle } from '@/shared/utils';
import type { Tables } from '@altitutor/shared';
import { useClassPlan } from '../hooks/useClassPlansQuery';
import { classPlansApi } from '../api/classPlans';
import { useQueryClient } from '@tanstack/react-query';
import { classPlansKeys } from '../hooks/useClassPlansQuery';

interface StudentListProps {
  planId: string;
  onSubjectFilterChange?: (subjectId: string | null) => void;
  onDragStart?: (subjectId: string) => void;
  onDragEnd?: () => void;
  selectedSubjectId?: string | null;
  onStudentDrop?: (studentId: string, subjectId: string) => void;
}

type StudentWithSubject = {
  student: Tables<'students'>;
  subject: Tables<'subjects'>;
};

export function StudentList({ planId, onSubjectFilterChange, onDragStart, onDragEnd, selectedSubjectId: externalSelectedSubjectId, onStudentDrop }: StudentListProps) {
  const qc = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [internalSelectedSubjectId, setInternalSelectedSubjectId] = useState<string | null>(null);
  
  const selectedSubjectId = externalSelectedSubjectId !== undefined ? externalSelectedSubjectId : internalSelectedSubjectId;
  
  const handleSubjectFilterChange = (subjectId: string | null) => {
    if (externalSelectedSubjectId === undefined) {
      setInternalSelectedSubjectId(subjectId);
    }
    onSubjectFilterChange?.(subjectId);
  };

  // Get plan data to check assigned students
  const { data: plan } = useClassPlan(planId);

  // Get all students with their subjects
  const { data: studentsWithSubjects, isLoading } = useQuery({
    queryKey: ['class-planner', 'students-subjects', planId],
    queryFn: async (): Promise<StudentWithSubject[]> => {
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
      
      // Get all students_subjects with joined data
      const { data, error } = await supabase
        .from('students_subjects')
        .select(`
          student:students(*),
          subject:subjects(*)
        `);
      
      if (error) throw error;
      
      return (data || [])
        .map((row: any) => ({
          student: row.student,
          subject: row.subject,
        }))
        .filter((item: StudentWithSubject) => item.student && item.subject) as StudentWithSubject[];
    },
  });

  // Filter out assigned students
  const unassignedStudents = useMemo(() => {
    if (!studentsWithSubjects || !plan) return studentsWithSubjects || [];
    
    // Get all assigned student-subject combinations
    const assignedSet = new Set<string>();
    plan.classes.forEach((cls) => {
      cls.students.forEach((student) => {
        // Create key: studentId-subjectId
        const key = `${student.id}-${cls.subject_id || 'null'}`;
        assignedSet.add(key);
      });
    });
    
    // Filter out assigned students
    return studentsWithSubjects.filter((item) => {
      const key = `${item.student.id}-${item.subject.id}`;
      return !assignedSet.has(key);
    });
  }, [studentsWithSubjects, plan]);

  // Get unique subjects for filtering
  const subjects = useMemo(() => {
    if (!studentsWithSubjects) return [];
    const subjectMap = new Map<string, Tables<'subjects'>>();
    studentsWithSubjects.forEach((item) => {
      if (!subjectMap.has(item.subject.id)) {
        subjectMap.set(item.subject.id, item.subject);
      }
    });
    return Array.from(subjectMap.values());
  }, [studentsWithSubjects]);

  // Filter students (using unassigned students)
  const filteredStudents = useMemo(() => {
    if (!unassignedStudents) return [];
    
    let filtered = unassignedStudents;
    
    // Filter by subject
    if (selectedSubjectId) {
      filtered = filtered.filter((item) => item.subject.id === selectedSubjectId);
    }
    
    // Filter by search term
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((item) => {
        const fullName = `${item.student.first_name || ''} ${item.student.last_name || ''}`.trim().toLowerCase();
        return (
          fullName.includes(searchLower) ||
          item.student.first_name?.toLowerCase().includes(searchLower) ||
          item.student.last_name?.toLowerCase().includes(searchLower) ||
          formatSubjectDisplay(item.subject).toLowerCase().includes(searchLower)
        );
      });
    }
    
    return filtered;
  }, [unassignedStudents, searchTerm, selectedSubjectId]);

  // Group by subject
  const groupedBySubject = useMemo(() => {
    const grouped: Record<string, StudentWithSubject[]> = {};
    filteredStudents.forEach((item) => {
      const subjectId = item.subject.id;
      if (!grouped[subjectId]) {
        grouped[subjectId] = [];
      }
      grouped[subjectId].push(item);
    });
    return grouped;
  }, [filteredStudents]);

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="text-sm text-muted-foreground">Loading students...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b space-y-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search students..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        {/* Subject filter */}
        {subjects.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => handleSubjectFilterChange(null)}
              className={`px-2 py-1 text-xs rounded ${
                selectedSubjectId === null
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              All
            </button>
            {subjects.map((subject) => {
              const { style, textColorClass } = getSubjectColorStyle(subject);
              return (
                <button
                  key={subject.id}
                  onClick={() => handleSubjectFilterChange(subject.id)}
                  className={`px-2 py-1 text-xs rounded ${
                    selectedSubjectId === subject.id
                      ? 'ring-2 ring-primary'
                      : ''
                  }`}
                  style={selectedSubjectId === subject.id ? style : undefined}
                >
                  {formatSubjectDisplay(subject)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Student List */}
      <div 
        className="flex-1 overflow-auto p-4 space-y-4"
        onDragOver={(e) => {
          e.preventDefault();
          // Allow drop if it's a JSON data type (student or class drag)
          if (e.dataTransfer.types.includes('application/json')) {
            e.dataTransfer.dropEffect = 'move';
          } else {
            e.dataTransfer.dropEffect = 'none';
          }
        }}
        onDrop={async (e) => {
          e.preventDefault();
          const dragData = e.dataTransfer.getData('application/json');
          if (!dragData) return;
          
          try {
            const data = JSON.parse(dragData);
            // Handle dropping student back to list (remove from class)
            if (data.studentId && data.fromClassId) {
              await classPlansApi.removeStudentFromDraftClass(data.fromClassId, data.studentId);
              qc.invalidateQueries({ queryKey: classPlansKeys.detail(planId) });
              onStudentDrop?.(data.studentId, data.subjectId);
              onDragEnd?.();
            }
          } catch (error) {
            console.error('Error removing student from class:', error);
          }
        }}
      >
        {filteredStudents.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            {searchTerm || selectedSubjectId
              ? 'No students found matching your filters'
              : 'No students with subjects found'}
          </div>
        ) : (
          Object.entries(groupedBySubject).map(([subjectId, items]) => {
            const subject = items[0].subject;
            const { style, textColorClass } = getSubjectColorStyle(subject);
            
            return (
              <div key={subjectId} className="space-y-2">
                <div
                  className="font-semibold text-sm px-2 py-1 rounded"
                  style={style}
                >
                  <span className={textColorClass}>{formatSubjectDisplay(subject)}</span>
                </div>
                <div className="space-y-1">
                  {items.map((item) => (
                    <Card
                      key={`${item.student.id}-${item.subject.id}`}
                      className="p-2 cursor-move hover:shadow-md transition-shadow"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(
                          'application/json',
                          JSON.stringify({
                            studentId: item.student.id,
                            subjectId: item.subject.id,
                          })
                        );
                        onDragStart?.(item.subject.id);
                      }}
                      onDragEnd={() => {
                        onDragEnd?.();
                      }}
                    >
                      <div className="text-sm font-medium">
                        {item.student.first_name} {item.student.last_name}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
