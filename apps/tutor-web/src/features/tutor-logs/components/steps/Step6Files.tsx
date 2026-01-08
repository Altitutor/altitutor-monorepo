'use client';

import { useState, useEffect } from 'react';
import { Checkbox } from '@altitutor/ui';
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

type Step6FilesProps = {
  topics: TopicItem[];
  topicFiles: TopicFileItem[];
  onUpdate: (topicFiles: TopicFileItem[]) => void;
};

export function Step6Files({ topics, topicFiles, onUpdate }: Step6FilesProps) {
  const [filesData, setFilesData] = useState<
    Record<string, Array<Tables<'topics_files'>>>
  >({});
  const [topicsData, setTopicsData] = useState<Tables<'topics'>[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
      const topicIds = topics.map((t) => t.topicId);

      if (topicIds.length === 0) {
        setIsLoading(false);
        return;
      }

      // Get all topics
      const { data: topicsRes } = await supabase
        .from('topics')
        .select('*')
        .in('id', topicIds);
      setTopicsData(topicsRes || []);

      // Get files for each topic using vtutor_topics_files view
      const filesMap: Record<string, Array<Tables<'topics_files'>>> = {};
      for (const topicId of topicIds) {
        const { data } = await supabase
          .from('vtutor_topics_files')
          .select('*')
          .eq('topic_id', topicId)
          .order('type')
          .order('index');
        // Filter out files with null IDs (shouldn't happen, but type safety)
        filesMap[topicId] = (data || []).filter((f): f is Tables<'topics_files'> => 
          f.id !== null && f.file_id !== null && f.topic_id !== null && f.index !== null
        );
      }
      setFilesData(filesMap);
      setIsLoading(false);
    };

    fetchData();
  }, [topics]);

  const handleToggleFile = (topicsFilesId: string, topicId: string, checked: boolean) => {
    if (checked) {
      onUpdate([...topicFiles, { topicsFilesId, topicId, studentIds: [] }]);
    } else {
      onUpdate(topicFiles.filter((tf) => tf.topicsFilesId !== topicsFilesId));
    }
  };

  const isFileSelected = (topicsFilesId: string) => {
    return topicFiles.some((tf) => tf.topicsFilesId === topicsFilesId);
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select which files were used in this session.
      </p>

      <div className="space-y-6">
        {topics.map((topic) => {
          const topicData = topicsData.find((t) => t.id === topic.topicId);
          const files = filesData[topic.topicId] || [];

          if (files.length === 0) return null;

          return (
            <div key={topic.topicId} className="border rounded-md p-4">
              <div className="font-medium mb-3">{topicData?.name}</div>
              <div className="space-y-2">
                {files.map((file) => {
                  const fileCode = file.code || '';

                  return (
                    <div key={file.id} className="flex items-center gap-2 py-1">
                      <Checkbox
                        checked={isFileSelected(file.id)}
                        onCheckedChange={(checked) =>
                          handleToggleFile(file.id, topic.topicId, checked === true)
                        }
                      />
                      <span className="font-mono text-sm">{fileCode}</span>
                    </div>
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


