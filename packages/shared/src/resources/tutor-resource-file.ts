import type { Database } from '../supabase/generated';
import { mapTopicFile } from './helpers';
import type { ResourceFile } from './types';

/** The resource association ID opens the file; the stored file ID submits it to the office printer. */
export type TutorResourceFile = ResourceFile & {
  fileId: string | null;
};

type TutorTopicFileRow = Database['public']['Views']['vtutor_topics_files']['Row'];

export function mapTutorTopicFile(row: TutorTopicFileRow): TutorResourceFile | null {
  const mapped = mapTopicFile(row);
  return mapped ? { ...mapped, fileId: row.file_id ?? null } : null;
}

export type OfficePrintableFile = {
  fileId: string | null;
  mimetype: string | null;
  filename: string;
  externalUrl: string | null;
};

export function isPdfResource(file: Pick<OfficePrintableFile, 'mimetype' | 'filename'>): boolean {
  return (file.mimetype ?? '').toLowerCase().includes('pdf') || file.filename.toLowerCase().endsWith('.pdf');
}

export function canPrintToOffice(file: OfficePrintableFile): boolean {
  return Boolean(file.fileId) && !file.externalUrl && isPdfResource(file);
}
