import type { Tables, TablesInsert, TablesUpdate } from '@altitutor/shared';

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
