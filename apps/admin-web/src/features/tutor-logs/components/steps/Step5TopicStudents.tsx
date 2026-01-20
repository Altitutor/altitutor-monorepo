'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { TopicCard } from '../TopicCard';
import { StudentCard } from '@/shared/components/StudentCard';
import { useTopicsByIds, useStudentsByIds, useTopicsWithSubjects } from '../../hooks';

type TopicItem = {
  topicId: string;
  studentIds: string[];
};

type Step5TopicStudentsProps = {
  title?: string;
  topics: TopicItem[];
  attendedStudentIds: string[];
  onUpdate: (topics: TopicItem[]) => void;
};

export function Step5TopicStudents({
  title,
  topics,
  attendedStudentIds,
  onUpdate,
}: Step5TopicStudentsProps) {
  const hasInitialized = useRef(false);

  // Fetch topics and students using hooks
  const topicIds = topics.map((t) => t.topicId);
  const { data: topicsData = [] } = useTopicsByIds(topicIds);
  const { data: studentsData = [] } = useStudentsByIds(attendedStudentIds);
  const { data: subjectsMap = new Map() } = useTopicsWithSubjects(topicIds);

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
  }, [topicsData.length, studentsData.length, topics.length, attendedStudentIds.length]);

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

  const getTopic = (topicId: string) => topicsData.find((t) => t.id === topicId);
  const getStudent = (studentId: string) => studentsData.find((s) => s.id === studentId);

  const allTopicsData = topicsData;

  return (
    <div className="space-y-4">
      {title && <h2 className="text-xl font-semibold">{title}</h2>}
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


