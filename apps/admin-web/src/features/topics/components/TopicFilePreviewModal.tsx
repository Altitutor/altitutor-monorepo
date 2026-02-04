'use client';

import { FilePreviewModal } from '@/shared/components/files/FilePreviewModal';
import { topicsFilesApi } from '../api/topics-files';
import { filesApi } from '../api/files';
import { topicsApi } from '../api/topics';
import type { FilePreviewModalProps } from '@/shared/components/files/FilePreviewModal';

/**
 * Topics-specific wrapper for FilePreviewModal
 * Automatically provides getMetadataFn for topic files
 */
export function TopicFilePreviewModal({
  topicFileId,
  ...props
}: Omit<FilePreviewModalProps, 'getMetadataFn' | 'junctionTableId'> & {
  topicFileId?: string | null;
}) {
  return (
    <FilePreviewModal
      {...props}
      junctionTableId={topicFileId}
      getMetadataFn={topicFileId
        ? async (id: string) => {
            // Fetch topic file with file and topic details
            const tf = await topicsFilesApi.getTopicFile(id);
            if (!tf) {
              throw new Error('Topic file not found');
            }

            const fileData = await filesApi.getFile(tf.file_id);
            if (!fileData) {
              throw new Error('File not found');
            }

            const topicData = await topicsApi.getTopic(tf.topic_id);
            if (!topicData) {
              throw new Error('Topic not found');
            }

            return {
              file: fileData,
              metadata: {
                topicFile: { ...tf, topic: topicData },
              },
            };
          }
        : undefined}
    />
  );
}
