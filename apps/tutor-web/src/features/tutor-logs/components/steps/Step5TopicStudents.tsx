'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { useTutorLogStep5Data } from '../../hooks/useTutorLogStep5Data';

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
  const topicIds = topics.map((t) => t.topicId);
  const { topicsData, studentsData, isLoading } = useTutorLogStep5Data(
    topicIds,
    attendedStudentIds
  );

  // Initialize with all students for all topics when data loads (only if any topic has empty studentIds)
  useEffect(() => {
    if (!isLoading && attendedStudentIds.length > 0) {
      const needsInit = topics.some((t) => t.studentIds.length === 0);
      if (!needsInit) return;
      const updatedTopics = topics.map((topic) => ({
        ...topic,
        studentIds:
          topic.studentIds.length > 0 ? topic.studentIds : attendedStudentIds,
      }));
      onUpdate(updatedTopics);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, attendedStudentIds.length, topics.length]);

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

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Assign students to topics. By default, all attending students are assigned to all topics.
      </p>

      <div className="space-y-4">
        {topics.map((topic) => {
          const topicData = getTopic(topic.topicId);
          if (!topicData) return null;

          return (
            <div key={topic.topicId} className="border rounded-md p-4">
              <div className="font-medium mb-3">{topicData.name}</div>
              <div className="flex flex-wrap gap-2">
                {topic.studentIds.map((studentId) => {
                  const student = getStudent(studentId);
                  if (!student) return null;

                  return (
                    <div
                      key={studentId}
                      className="flex items-center gap-1 px-2 py-1 bg-primary/10 rounded-md text-sm"
                    >
                      <span>
                        {student.first_name} {student.last_name}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveStudent(topic.topicId, studentId)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
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
                        className="px-2 py-1 border border-dashed rounded-md text-sm hover:bg-accent"
                      >
                        + {student.first_name} {student.last_name}
                      </button>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


