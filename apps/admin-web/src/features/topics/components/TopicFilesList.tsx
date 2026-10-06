'use client';

import type { Enums } from '@altitutor/shared';
import { FileCard } from '@/shared/components/files/FileCard';
import { getFileTypeLabel } from '@/shared/utils/file-type-icons';
import { groupFilesByType, getTopicFileDisplayRows, type TopicFileWithFile } from '../utils/fileDisplay';

interface TopicFilesListProps {
  files: TopicFileWithFile[];
  topicName: string;
  onEdit: (fileId: string) => void;
}

function TopicResourceCard({ file, topicName, onEdit }: {
  file: TopicFileWithFile;
  topicName: string;
  onEdit: (fileId: string) => void;
}) {
  return (
    <FileCard
      fileCode={file.code || ''}
      fileType={file.type}
      filename={file.file.filename}
      storagePath={file.file.storage_path}
      externalUrl={file.file.external_url}
      mimeType={file.file.mimetype}
      topicFileId={file.id}
      fileId={file.file.id}
      topicName={topicName}
      onEdit={onEdit}
    />
  );
}

export function TopicFilesList({ files, topicName, onEdit }: TopicFilesListProps) {
  return (
    <div className="space-y-6">
      {Object.entries(groupFilesByType(files)).map(([type, group]) => group.length > 0 ? (
        <section key={type} className="space-y-2" aria-label={getFileTypeLabel(type as Enums<'resource_type'>)}>
          <h4 className="font-semibold text-sm">{getFileTypeLabel(type as Enums<'resource_type'>)}</h4>
          <div className="grid grid-cols-2 gap-2 text-xs font-medium text-muted-foreground">
            <span>File</span>
            <span>Solutions</span>
          </div>
          {getTopicFileDisplayRows(group).map(row => (
            <div key={row.kind === 'paired' ? row.file.id : row.solution.id} className="grid grid-cols-2 gap-2">
              {row.kind === 'paired' ? (
                <TopicResourceCard file={row.file} topicName={topicName} onEdit={onEdit} />
              ) : (
                <div className="border border-dashed rounded-lg flex items-center justify-center min-h-[60px] text-xs text-muted-foreground">No file</div>
              )}
              {row.solution ? (
                <TopicResourceCard file={row.solution} topicName={topicName} onEdit={onEdit} />
              ) : (
                <div className="border border-dashed rounded-lg flex items-center justify-center min-h-[60px] text-xs text-muted-foreground">No solution</div>
              )}
            </div>
          ))}
        </section>
      ) : null)}
    </div>
  );
}
