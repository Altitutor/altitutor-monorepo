'use client';

import { useState } from 'react';
import { Button, Checkbox } from '@altitutor/ui';
import { Eye } from 'lucide-react';
import { useTutorLogStep6Data } from '../../hooks/useTutorLogStep6Data';
import type { TutorTopicFileWithFileFields } from '@/features/topics/api/topics-files';
import { ResourceFilePreviewDialog } from '@/features/resources/components/resource-file-preview-dialog';
import type { TutorResourceFile } from '@/features/resources/lib/types';
import { cn } from '@/shared/utils';
import { tutorBtnOutline, tutorCardCn } from '@/shared/lib/tutor-visual';

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

function toPreviewFile(file: TutorTopicFileWithFileFields): TutorResourceFile {
  return {
    id: file.id,
    topicId: file.topic_id,
    code: file.code,
    type: file.type,
    index: file.index,
    filename: file.filename?.trim() || 'Untitled file',
    mimetype: file.mimetype,
    storagePath: file.storage_path,
    bucket: null,
    externalUrl: file.external_url,
    isSolutions: file.is_solutions,
    isSolutionsOfId: file.is_solutions_of_id,
    fileId: file.file_id,
  };
}

export function Step6Files({ topics, topicFiles, onUpdate }: Step6FilesProps) {
  const topicIds = topics.map((t) => t.topicId);
  const { topicsData, filesData, isLoading } = useTutorLogStep6Data(topicIds);
  const [previewFile, setPreviewFile] = useState<TutorResourceFile | null>(null);

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
            <div key={topic.topicId} className={tutorCardCn('p-4')}>
              <div className="mb-3 font-medium">{topicData?.name}</div>
              <div className="space-y-2">
                {files.map((file) => {
                  const fileCode = file.code || '';
                  const filename = file.filename?.trim() || 'Untitled file';
                  const selected = isFileSelected(file.id);

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
                      className="flex cursor-pointer items-center gap-2 rounded-md py-1 hover:bg-muted/40"
                    >
                      <Checkbox checked={selected} tabIndex={-1} className="pointer-events-none" />
                      <div className="min-w-0 flex-1">
                        <span className="font-mono text-sm">{fileCode}</span>
                        <span className="mx-2 text-muted-foreground">·</span>
                        <span className="text-sm">{filename}</span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn(tutorBtnOutline, 'shrink-0')}
                        onClick={(event) => {
                          event.stopPropagation();
                          setPreviewFile(toPreviewFile(file));
                        }}
                      >
                        <Eye className="mr-1.5 h-4 w-4" />
                        View
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <ResourceFilePreviewDialog
        file={previewFile}
        open={Boolean(previewFile)}
        onOpenChange={(open) => {
          if (!open) setPreviewFile(null);
        }}
        filePageHref=""
      />
    </div>
  );
}
