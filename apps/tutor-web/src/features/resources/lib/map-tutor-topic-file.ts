import { mapTopicFile } from '@altitutor/shared';
import type { TutorResourceFile, TutorTopicFileRow } from './types';

export function mapTutorTopicFile(row: TutorTopicFileRow): TutorResourceFile | null {
  const mapped = mapTopicFile(row);
  if (!mapped) return null;
  return {
    ...mapped,
    fileId: row.file_id ?? null,
  };
}
