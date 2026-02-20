import type { Tables, TablesInsert, TablesUpdate } from '@altitutor/shared';
import type { JSONContent } from '@altitutor/ui';

/**
 * Form values for note detail page (aligned with note form schema).
 */
export interface NoteFormData {
  title: string;
  content: JSONContent | string;
  folder_id?: string | null;
  project_id?: string | null;
}

/**
 * Note document type from database
 */
export type Note = Tables<'notes_documents'>;

/**
 * Note insert type
 */
export type NoteInsert = TablesInsert<'notes_documents'>;

/**
 * Note update type
 */
export type NoteUpdate = TablesUpdate<'notes_documents'>;

/**
 * Daily note type from database
 */
export type DailyNote = Tables<'notes_daily'>;

/**
 * Daily note update type
 */
export type DailyNoteUpdate = TablesUpdate<'notes_daily'>;

/**
 * Folder type from database
 */
export type Folder = Tables<'notes_folders'>;

/**
 * Folder insert type
 */
export type FolderInsert = TablesInsert<'notes_folders'>;

/**
 * Folder update type
 */
export type FolderUpdate = TablesUpdate<'notes_folders'>;

/**
 * Folder with nested content (notes and children folders)
 */
export type FolderWithContent = Folder & {
  notes: Note[];
  children: FolderWithContent[];
};

/**
 * Folder tree type for hierarchical display
 */
export type FolderTreeItem = Folder & {
  notes: Note[];
  children: FolderTreeItem[];
};
