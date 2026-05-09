'use client';

import { useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { Button, SearchableSelect } from '@altitutor/ui';
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
                {(() => {
                  const studentsToAdd = attendedStudentIds
                    .filter((id) => !topic.studentIds.includes(id))
                    .map((id) => getStudent(id))
                    .filter((s): s is Tables<'students'> => s != null);
                  if (studentsToAdd.length === 0) return null;
                  return (
                    <div className="basis-full mt-3 w-full min-w-0">
                    <SearchableSelect<Tables<'students'>>
                      items={studentsToAdd}
                      value={null}
                      onValueChange={(student) => {
                        if (student) handleAddStudent(topic.topicId, student.id);
                      }}
                      getItemId={(s) => s.id}
                      getItemLabel={(s) => `${s.first_name} ${s.last_name}`}
                      getItemValue={(s) =>
                        `${s.first_name} ${s.last_name} ${s.email ?? ''} ${s.year_level ?? ''}`.toLowerCase()
                      }
                      searchPlaceholder="Find student..."
                      emptyMessage="All attending students are assigned to this topic"
                      trigger={
                        <Button variant="outline" size="sm" className="border-dashed">
                          <Plus className="h-3 w-3 mr-1" />
                          Add student
                        </Button>
                      }
                      align="start"
                      contentWidth="min(320px, 90vw)"
                      renderItem={(student) => (
                        <div className="flex w-full items-center justify-between gap-2 min-w-0">
                          <span className="min-w-0 truncate">
                            {student.first_name} {student.last_name}
                          </span>
                          {student.year_level != null && (
                            <span className="text-sm text-muted-foreground shrink-0">
                              Year {student.year_level}
                            </span>
                          )}
                        </div>
                      )}
                    />
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


