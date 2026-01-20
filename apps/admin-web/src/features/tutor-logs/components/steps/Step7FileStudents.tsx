'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { FileCard } from '@/features/topics/components/FileCard';
import { StudentCard } from '@/shared/components/StudentCard';
import type { Tables } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

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
  title?: string;
  topics: TopicItem[];
  topicFiles: TopicFileItem[];
  onUpdate: (topicFiles: TopicFileItem[]) => void;
};

type TopicFileWithFile = Tables<'topics_files'> & {
  file: Tables<'files'>;
};

export function Step7FileStudents({
  title,
  topics,
  topicFiles,
  onUpdate,
}: Step7FileStudentsProps) {
  const [filesData, setFilesData] = useState<TopicFileWithFile[]>([]);
  const [topicsData, setTopicsData] = useState<Tables<'topics'>[]>([]);
  const [studentsData, setStudentsData] = useState<Tables<'students'>[]>([]);

  useEffect(() => {
    // Early return if no files - nothing to fetch or update
    if (topicFiles.length === 0) {
      return;
    }

    const fetchData = async () => {
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);

      const fileIds = topicFiles.map((tf) => tf.topicsFilesId);
      const topicIds = topics.map((t) => t.topicId);
      const studentIds = Array.from(new Set(topics.flatMap((t) => t.studentIds)));

      if (fileIds.length > 0) {
        const { data: filesRes } = await supabase
          .from('topics_files')
          .select(`
            *,
            file:files(*)
          `)
          .in('id', fileIds);
        setFilesData((filesRes || []) as TopicFileWithFile[]);
      }

      if (topicIds.length > 0) {
        const { data: topicsRes } = await supabase
          .from('topics')
          .select('*')
          .in('id', topicIds);
        setTopicsData(topicsRes || []);
      }

      if (studentIds.length > 0) {
        const { data: studentsRes } = await supabase
          .from('students')
          .select('*')
          .in('id', studentIds);
        setStudentsData(studentsRes || []);
      }

      // Initialize with students from the topic only if needed
      const updatedFiles = topicFiles.map((file) => {
        const topic = topics.find((t) => t.topicId === file.topicId);
        return {
          ...file,
          studentIds: file.studentIds.length > 0 ? file.studentIds : (topic?.studentIds || []),
        };
      });
      
      // Only update if there's an actual change
      const hasChanges = updatedFiles.some((file, index) => {
        const original = topicFiles[index];
        return JSON.stringify(file.studentIds) !== JSON.stringify(original?.studentIds);
      });
      
      if (hasChanges) {
        onUpdate(updatedFiles);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicFiles, topics]);

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
      {title && <h2 className="text-xl font-semibold">{title}</h2>}
      <p className="text-sm text-muted-foreground">
        Assign students to files. By default, if a student studied a topic, they are assigned to that topic's files. You can proceed without assigning students.
      </p>

      {topicFiles.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No files selected.
        </div>
      ) : (
        <div className="space-y-3">
          {topicFiles.map((file) => {
          const fileData = getFile(file.topicsFilesId);
          const topicData = getTopic(file.topicId);
          if (!fileData || !topicData) return null;

          const fileCode = fileData?.code || '';
          const availableStudents = getAvailableStudents(file.topicId);

          return (
            <div key={file.topicsFilesId} className="border rounded-lg p-4 space-y-3">
              {fileData.file?.filename ? (
                <FileCard
                  fileCode={fileCode}
                  fileType={fileData.type}
                  filename={fileData.file.filename}
                  storagePath={fileData.file.storage_path}
                  mimeType={fileData.file.mimetype || undefined}
                  topicFileId={fileData.id}
                />
              ) : (
                <div className="text-sm text-muted-foreground p-2 border rounded">
                  File name unavailable
                </div>
              )}
              
              {/* Students inside the file card */}
              {file.studentIds.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Students:</div>
                  <div className="flex flex-wrap gap-1">
                    {file.studentIds.map((studentId) => {
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
                              onClick={() => handleRemoveStudent(file.topicsFilesId, studentId)}
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
              {availableStudents
                .filter((id) => !file.studentIds.includes(id))
                .length > 0 && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Add Students:</div>
                  <div className="flex flex-wrap gap-2">
                    {availableStudents
                      .filter((id) => !file.studentIds.includes(id))
                      .map((studentId) => {
                        const student = getStudent(studentId);
                        if (!student) return null;

                        return (
                          <button
                            key={studentId}
                            type="button"
                            onClick={() => handleAddStudent(file.topicsFilesId, studentId)}
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
      )}
    </div>
  );
}


