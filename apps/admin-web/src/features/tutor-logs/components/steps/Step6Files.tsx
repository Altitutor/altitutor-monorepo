'use client';

import { useState } from 'react';
import { Button, Checkbox } from '@altitutor/ui';
import { Eye } from 'lucide-react';
import { FilePreviewModal } from '@/shared/components/files/FilePreviewModal';
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
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const [previewTopicFileId, setPreviewTopicFileId] = useState<string | null>(null);

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
                  const filename = file.file?.filename?.trim() || 'Untitled file';
                  const selected = isFileSelected(file.id);
                  const fileId = file.file_id ?? file.file?.id ?? null;

                  return (
                    <div
                      key={file.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={selected}
                      onClick={() => handleToggleFile(file.id, topic.topicId, !selected)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handleToggleFile(file.id, topic.topicId, !selected);
                        }
                      }}
                      className="flex cursor-pointer items-center gap-3 rounded-md p-1 hover:bg-muted/40"
                    >
                      <Checkbox checked={selected} tabIndex={-1} className="pointer-events-none" />
                      <div className="min-w-0 flex-1">
                        <span className="font-mono text-sm">{fileCode}</span>
                        <span className="mx-2 text-muted-foreground">·</span>
                        <span className="text-sm">{filename}</span>
                      </div>
                      {fileId ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={(event) => {
                            event.stopPropagation();
                            setPreviewFileId(fileId);
                            setPreviewTopicFileId(file.id);
                          }}
                        >
                          <Eye className="mr-1.5 h-4 w-4" />
                          View
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <FilePreviewModal
        isOpen={!!previewFileId}
        fileId={previewFileId}
        topicFileId={previewTopicFileId}
        onClose={() => {
          setPreviewFileId(null);
          setPreviewTopicFileId(null);
        }}
      />
    </div>
  );
}
