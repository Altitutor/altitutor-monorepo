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

interface StudentListProps {
  planId: string;
}

type StudentWithSubject = {
  student: Tables<'students'>;
  subject: Tables<'subjects'>;
};

export function StudentList({ planId }: StudentListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

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

  // Filter students
  const filteredStudents = useMemo(() => {
    if (!studentsWithSubjects) return [];
    
    let filtered = studentsWithSubjects;
    
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
  }, [studentsWithSubjects, searchTerm, selectedSubjectId]);

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
              onClick={() => setSelectedSubjectId(null)}
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
                  onClick={() => setSelectedSubjectId(subject.id)}
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
      <div className="flex-1 overflow-auto p-4 space-y-4">
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
