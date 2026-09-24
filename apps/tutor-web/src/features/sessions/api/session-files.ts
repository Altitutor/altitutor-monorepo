import type { Tables } from '@altitutor/shared';

/**
 * Session Files API for managing files linked to sessions
 */

export interface SessionFileWithUrl extends Tables<'sessions_files'> {
  file: Tables<'files'>;
  signedUrl: string;
}

export const sessionFilesApi = {
  /**
   * Upload a file for a session and create database records
   */
  uploadSessionFile: async (params: {
    sessionId: string;
    file: File;
    displayOrder?: number;
  }): Promise<Tables<'sessions_files'>> => {
    const form = new FormData();
    form.set('sessionId', params.sessionId);
    form.set('file', params.file);
    form.set('displayOrder', String(params.displayOrder ?? 0));
    const response = await fetch('/api/session-files', { method: 'POST', body: form });
    if (!response.ok) throw new Error('Failed to upload session file');
    return await response.json() as Tables<'sessions_files'>;
  },

  /**
   * Get all files for a session with signed URLs
   */
  getSessionFiles: async (sessionId: string): Promise<SessionFileWithUrl[]> => {
    const response = await fetch(`/api/session-files?sessionId=${encodeURIComponent(sessionId)}`);
    if (!response.ok) throw new Error('Failed to get session files');
    return await response.json() as SessionFileWithUrl[];
  },

  /**
   * Delete a session file (removes from storage and database)
   */
  deleteSessionFile: async (fileId: string): Promise<void> => {
    const response = await fetch(`/api/session-files?fileId=${encodeURIComponent(fileId)}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete session file');
  },

  /**
   * Update display order of files in a session
   */
  updateFileDisplayOrder: async (sessionFileId: string, displayOrder: number): Promise<void> => {
    const response = await fetch('/api/session-files', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionFileId, displayOrder }),
    });
    if (!response.ok) throw new Error('Failed to update file display order');
  },
};
