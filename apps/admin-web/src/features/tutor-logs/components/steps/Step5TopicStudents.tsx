'use client';

import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { TopicCard } from '../TopicCard';
import { StudentCard } from '@/shared/components/StudentCard';
import type { Tables } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

type TopicItem = {
  topicId: string;
  studentIds: string[];
};

type Step5TopicStudentsProps = {
  topics: TopicItem[];
  attendedStudentIds: string[];
  onUpdate: (topics: TopicItem[]) => void;
};

export function Step5TopicStudents({
  topics,
  attendedStudentIds,
  onUpdate,
}: Step5TopicStudentsProps) {
  const [topicsData, setTopicsData] = useState<Tables<'topics'>[]>([]);
  const [studentsData, setStudentsData] = useState<Tables<'students'>[]>([]);
  const hasInitialized = useRef(false);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);

      const topicIds = topics.map((t) => t.topicId);

      if (topicIds.length > 0) {
        const { data: topicsRes } = await supabase
          .from('topics')
          .select('*')
          .in('id', topicIds);
        setTopicsData(topicsRes || []);
      }

      if (attendedStudentIds.length > 0) {
        const { data: studentsRes } = await supabase
          .from('students')
          .select('*')
          .in('id', attendedStudentIds);
        setStudentsData(studentsRes || []);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendedStudentIds.length, topics.length]);

  // Initialize with all students for all topics (separate effect to avoid setState during render)
  useEffect(() => {
    if (!hasInitialized.current && topics.length > 0 && topicsData.length > 0 && studentsData.length > 0) {
      const needsUpdate = topics.some((topic) => topic.studentIds.length === 0);
      if (needsUpdate && attendedStudentIds.length > 0) {
        hasInitialized.current = true;
        const updatedTopics = topics.map((topic) => ({
          ...topic,
          studentIds: topic.studentIds.length > 0 ? topic.studentIds : attendedStudentIds,
        }));
        onUpdate(updatedTopics);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicsData.length, studentsData.length]);

  const handleRemoveStudent = (topicId: string, studentId: string) => {
    onUpdate(
      topics.map((t) =>
        t.topicId === topicId
          ? { ...t, studentIds: t.studentIds.filter((id) => id !== studentId) }
          : t
      )
    );
  };

  const handleAddStudent = (topicId: string, studentId: string) => {
    onUpdate(
      topics.map((t) =>
        t.topicId === topicId && !t.studentIds.includes(studentId)
          ? { ...t, studentIds: [...t.studentIds, studentId] }
          : t
      )
    );
  };

  const [subjectsMap, setSubjectsMap] = useState<Map<string, Tables<'subjects'>>>(new Map());

  useEffect(() => {
    const fetchSubjects = async () => {
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      const topicIds = topics.map((t) => t.topicId);
      if (topicIds.length > 0) {
        // Get unique subject IDs from topics
        const { data: topicsWithSubjects } = await supabase
          .from('topics')
          .select('id, subject_id, subjects:subjects(*)')
          .in('id', topicIds);
        
        if (topicsWithSubjects) {
          const subjects = new Map<string, Tables<'subjects'>>();
          topicsWithSubjects.forEach((t: any) => {
            if (t.subjects && t.subject_id) {
              subjects.set(t.subject_id, t.subjects);
            }
          });
          setSubjectsMap(subjects);
        }
      }
    };
    fetchSubjects();
  }, [topics]);

  const getTopic = (topicId: string) => topicsData.find((t) => t.id === topicId);
  const getStudent = (studentId: string) => studentsData.find((s) => s.id === studentId);

  const allTopicsData = topicsData;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Assign students to topics. By default, all attending students are assigned to all topics.
      </p>

      <div className="space-y-3">
        {topics.map((topic) => {
          const topicData = getTopic(topic.topicId);
          if (!topicData) return null;
          const parentTopic = topicData.parent_id ? allTopicsData.find((t) => t.id === topicData.parent_id) : undefined;
          const subject = topicData.subject_id ? subjectsMap.get(topicData.subject_id) : undefined;

          return (
            <div key={topic.topicId} className="border rounded-lg p-4 space-y-3">
              <TopicCard
                topic={topicData}
                allTopics={allTopicsData}
                subject={subject}
                parentTopic={parentTopic}
              />
              
              {/* Students inside the topic card */}
              {topic.studentIds.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Students:</div>
                  <div className="flex flex-wrap gap-1">
                    {topic.studentIds.map((studentId) => {
                      const student = getStudent(studentId);
                      if (!student) return null;

                      return (
                        <div key={studentId} className="cursor-pointer">
                          <div className="flex items-center gap-1">
                            <StudentCard
                              student={student}
                              showSubjects={false}
                              showActions={false}
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveStudent(topic.topicId, studentId)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Add students */}
              {attendedStudentIds
                .filter((id) => !topic.studentIds.includes(id))
                .length > 0 && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Add Students:</div>
                  <div className="flex flex-wrap gap-2">
                    {attendedStudentIds
                      .filter((id) => !topic.studentIds.includes(id))
                      .map((studentId) => {
                        const student = getStudent(studentId);
                        if (!student) return null;

                        return (
                          <button
                            key={studentId}
                            type="button"
                            onClick={() => handleAddStudent(topic.topicId, studentId)}
                            className="px-2 py-1 border border-dashed rounded-md text-sm hover:bg-brand-lightBlue/10 dark:hover:bg-brand-dark-card/70"
                          >
                            + {student.first_name} {student.last_name}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


