'use client';

import { useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { Button, SearchableSelect } from '@altitutor/ui';
import { useTutorLogStep7Data } from '../../hooks/useTutorLogStep7Data';

type TopicItem = {
  topicId: string;
  studentIds: string[];
};

type TopicFileItem = {
  topicsFilesId: string;
  topicId: string;
  studentIds: string[];
};

type Step7FileStudentsProps = {
  topics: TopicItem[];
  topicFiles: TopicFileItem[];
  onUpdate: (topicFiles: TopicFileItem[]) => void;
};

export function Step7FileStudents({
  topics,
  topicFiles,
  onUpdate,
}: Step7FileStudentsProps) {
  const fileIds = topicFiles.map((tf) => tf.topicsFilesId);
  const topicIds = topics.map((t) => t.topicId);
  const studentIds = Array.from(new Set(topics.flatMap((t) => t.studentIds)));

  const { filesData, topicsData, studentsData, isLoading } = useTutorLogStep7Data(
    topicIds,
    fileIds,
    studentIds
  );

  // Initialize file studentIds from topic when data loads
  useEffect(() => {
    if (!isLoading && topicFiles.length > 0) {
      const needsInit = topicFiles.some((f) => f.studentIds.length === 0);
      if (!needsInit) return;
      const updatedFiles = topicFiles.map((file) => {
        const topic = topics.find((t) => t.topicId === file.topicId);
        return {
          ...file,
          studentIds:
            file.studentIds.length > 0 ? file.studentIds : (topic?.studentIds || []),
        };
      });
      onUpdate(updatedFiles);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, topicFiles.length, topics.length]);

  const handleRemoveStudent = (fileId: string, studentId: string) => {
    onUpdate(
      topicFiles.map((tf) =>
        tf.topicsFilesId === fileId
          ? { ...tf, studentIds: tf.studentIds.filter((id) => id !== studentId) }
          : tf
      )
    );
  };

  const handleAddStudent = (fileId: string, studentId: string) => {
    onUpdate(
      topicFiles.map((tf) =>
        tf.topicsFilesId === fileId && !tf.studentIds.includes(studentId)
          ? { ...tf, studentIds: [...tf.studentIds, studentId] }
          : tf
      )
    );
  };

  const getFile = (fileId: string) => filesData.find((f) => f.id === fileId);
  const getTopic = (topicId: string) => topicsData.find((t) => t.id === topicId);
  const getStudent = (studentId: string) => studentsData.find((s) => s.id === studentId);

  // Get available students for a file (students from that topic)
  const getAvailableStudents = (topicId: string) => {
    const topic = topics.find((t) => t.topicId === topicId);
    return topic?.studentIds || [];
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Assign students to files. By default, if a student studied a topic, they are assigned to that topic's files.
      </p>

      <div className="space-y-4">
        {topicFiles.map((file) => {
          const fileData = getFile(file.topicsFilesId);
          const topicData = getTopic(file.topicId);
          if (!fileData || !topicData) return null;

          const fileCode = fileData?.code || '';
          const availableStudents = getAvailableStudents(file.topicId);

          return (
            <div key={file.topicsFilesId} className="border rounded-md p-4">
              <div className="font-medium font-mono text-sm mb-3">{fileCode}</div>
              <div className="flex flex-wrap gap-2">
                {file.studentIds.map((studentId) => {
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
                        onClick={() => handleRemoveStudent(file.topicsFilesId, studentId)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
                {(() => {
                  const studentsToAdd = availableStudents
                    .filter((id) => !file.studentIds.includes(id))
                    .map((id) => getStudent(id))
                    .filter((s): s is Tables<'students'> => s != null);
                  if (studentsToAdd.length === 0) return null;
                  return (
                    <div className="basis-full mt-3 w-full min-w-0">
                    <SearchableSelect<Tables<'students'>>
                      items={studentsToAdd}
                      value={null}
                      onValueChange={(student) => {
                        if (student) handleAddStudent(file.topicsFilesId, student.id);
                      }}
                      getItemId={(s) => s.id}
                      getItemLabel={(s) => `${s.first_name} ${s.last_name}`}
                      getItemValue={(s) =>
                        `${s.first_name} ${s.last_name} ${s.email ?? ''} ${s.year_level ?? ''}`.toLowerCase()
                      }
                      searchPlaceholder="Find student..."
                      emptyMessage="All students for this topic are assigned to this file"
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


