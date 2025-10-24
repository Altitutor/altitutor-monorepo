'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { deriveTopicCode, deriveTopicFileCode } from '@/features/topics/utils/codes';

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
  const [filesData, setFilesData] = useState<Tables<'topics_files'>[]>([]);
  const [topicsData, setTopicsData] = useState<Tables<'topics'>[]>([]);
  const [studentsData, setStudentsData] = useState<Tables<'students'>[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = getSupabaseClient();

      const fileIds = topicFiles.map((tf) => tf.topicsFilesId);
      const topicIds = topics.map((t) => t.topicId);
      const studentIds = Array.from(new Set(topics.flatMap((t) => t.studentIds)));

      if (fileIds.length > 0) {
        const { data: filesRes } = await supabase
          .from('topics_files')
          .select('*')
          .in('id', fileIds);
        setFilesData(filesRes || []);
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

      // Initialize with students from the topic
      const updatedFiles = topicFiles.map((file) => {
        const topic = topics.find((t) => t.topicId === file.topicId);
        return {
          ...file,
          studentIds: file.studentIds.length > 0 ? file.studentIds : (topic?.studentIds || []),
        };
      });
      onUpdate(updatedFiles);
    };

    fetchData();
  }, []);

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

          const topicCode = deriveTopicCode(topicData, topicsData);
          const fileCode = deriveTopicFileCode(fileData, topicCode, fileData.type);
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

