'use client';

import { useState } from 'react';
import { Button, Checkbox } from '@altitutor/ui';
import { Eye } from 'lucide-react';
import { FilePreviewModal } from '@/shared/components/files/FilePreviewModal';
import { getFileTypeLabel } from '@/shared/utils/file-type-icons';
import { groupFilesByType } from '@/features/topics/utils/fileDisplay';
import type { Enums } from '@altitutor/shared';
import { useTopicsByIds, useTopicFilesByTopicIds } from '../../hooks';
import type { TopicFileWithFile } from '../../hooks/useTopicFilesByTopicIds';

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

function FileSelectRow({
  file,
  topicId,
  selected,
  onToggle,
  onPreview,
}: {
  file: TopicFileWithFile;
  topicId: string;
  selected: boolean;
  onToggle: (topicsFilesId: string, topicId: string, checked: boolean) => void;
  onPreview: (fileId: string, topicFileId: string) => void;
}) {
  const fileCode = file.code || '';
  const filename = file.file?.filename?.trim() || 'Untitled file';
  const fileId = file.file_id ?? file.file?.id ?? null;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={() => onToggle(file.id, topicId, !selected)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onToggle(file.id, topicId, !selected);
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
            onPreview(fileId, file.id);
          }}
        >
          <Eye className="mr-1.5 h-4 w-4" />
          View
        </Button>
      ) : null}
    </div>
  );
}

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
          const filesByType = groupFilesByType(files);

          return (
            <div key={topic.topicId} className="space-y-3">
              <div className="font-semibold text-base">
                {topicCode} {topicData?.name}
              </div>
              <div className="space-y-4">
                {Object.entries(filesByType).map(([type, typeFiles]) => {
                  if (typeFiles.length === 0) return null;

                  const typeLabel = getFileTypeLabel(type as Enums<'resource_type'>);

                  return (
                    <div key={type} className="space-y-2">
                      <h4 className="text-sm font-semibold text-muted-foreground">{typeLabel}</h4>
                      <div className="space-y-2">
                        {typeFiles.map((file) => (
                          <FileSelectRow
                            key={file.id}
                            file={file}
                            topicId={topic.topicId}
                            selected={isFileSelected(file.id)}
                            onToggle={handleToggleFile}
                            onPreview={(fileId, topicFileId) => {
                              setPreviewFileId(fileId);
                              setPreviewTopicFileId(topicFileId);
                            }}
                          />
                        ))}
                      </div>
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
