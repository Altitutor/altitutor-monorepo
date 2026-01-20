'use client';

import { Checkbox } from '@altitutor/ui';
import { FileCard } from '@/features/topics/components/FileCard';
import { useTopicsByIds, useTopicFilesByTopicIds } from '../../hooks';

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
  title?: string;
  topics: TopicItem[];
  topicFiles: TopicFileItem[];
  onUpdate: (topicFiles: TopicFileItem[]) => void;
};

export function Step6Files({ title, topics, topicFiles, onUpdate }: Step6FilesProps) {
  const topicIds = topics.map((t) => t.topicId);

  // Fetch topics and topic files using hooks
  const { data: topicsData = [], isLoading: isLoadingTopics } = useTopicsByIds(topicIds);
  const { data: filesData = {}, isLoading: isLoadingFiles } = useTopicFilesByTopicIds(topicIds);

  const isLoading = isLoadingTopics || isLoadingFiles;

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
      {title && <h2 className="text-xl font-semibold">{title}</h2>}
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


