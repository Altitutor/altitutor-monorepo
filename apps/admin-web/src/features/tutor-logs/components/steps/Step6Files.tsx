'use client';

import { useState, useEffect } from 'react';
import { Checkbox } from '@altitutor/ui';
import { FileCard } from '@/features/topics/components/FileCard';
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

type TopicFileWithFile = Tables<'topics_files'> & {
  file: Tables<'files'>;
};

export function Step6Files({ topics, topicFiles, onUpdate }: Step6FilesProps) {
  const [filesData, setFilesData] = useState<
    Record<string, Array<TopicFileWithFile>>
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

      // Get files for each topic with file details
      const filesMap: Record<string, Array<TopicFileWithFile>> = {};
      for (const topicId of topicIds) {
        const { data } = await supabase
          .from('topics_files')
          .select(`
            *,
            file:files(*)
          `)
          .eq('topic_id', topicId)
          .order('type')
          .order('index');
        filesMap[topicId] = (data || []) as TopicFileWithFile[];
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
        Select which files were used in this session. You can proceed without selecting any files.
      </p>

      <div className="space-y-6">
        {topics.map((topic) => {
          const topicData = topicsData.find((t) => t.id === topic.topicId);
          const files = filesData[topic.topicId] || [];

          if (files.length === 0) return null;

          const topicCode = topicData?.code || '';

          return (
            <div key={topic.topicId} className="space-y-3">
              <div className="font-semibold text-base">
                {topicCode} {topicData?.name}
              </div>
              <div className="space-y-2">
                {files.map((file) => {
                  const fileCode = file.code || '';

                  return (
                    <div key={file.id} className="flex items-center gap-3">
                      <Checkbox
                        checked={isFileSelected(file.id)}
                        onCheckedChange={(checked) =>
                          handleToggleFile(file.id, topic.topicId, checked === true)
                        }
                      />
                      <div className="flex-1">
                        {file.file?.filename ? (
                          <FileCard
                            fileCode={fileCode}
                            fileType={file.type}
                            filename={file.file.filename}
                            storagePath={file.file.storage_path}
                            mimeType={file.file.mimetype || undefined}
                            topicFileId={file.id}
                          />
                        ) : (
                          <div className="text-sm text-muted-foreground">File name unavailable</div>
                        )}
                      </div>
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


