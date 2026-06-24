import type { Database, Tables } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/shared/lib/supabase/client';

export type NoteDocumentEditLock = {
  note_id: string;
  locked_by: string;
  lock_token: string;
  updated_at: string;
  locked_by_staff?: Pick<Tables<'staff'>, 'id' | 'first_name' | 'last_name'> | null;
};

const LOCK_SELECT = `
  note_id,
  locked_by,
  lock_token,
  updated_at,
  locked_by_staff:staff!note_document_edit_locks_locked_by_fkey(id, first_name, last_name)
`;

function client() {
  return getSupabaseClient() as SupabaseClient<Database>;
}

function normalizeLock(data: unknown): NoteDocumentEditLock {
  const row = data as NoteDocumentEditLock & {
    locked_by_staff?: NoteDocumentEditLock['locked_by_staff'] | NoteDocumentEditLock['locked_by_staff'][];
  };
  const staff = Array.isArray(row.locked_by_staff)
    ? row.locked_by_staff[0] ?? null
    : row.locked_by_staff ?? null;

  return {
    note_id: row.note_id,
    locked_by: row.locked_by,
    lock_token: row.lock_token,
    updated_at: row.updated_at,
    locked_by_staff: staff,
  };
}

export const documentEditLocksApi = {
  get: async (noteId: string): Promise<NoteDocumentEditLock | null> => {
    const supabase = client();
    const { data, error } = await (supabase as unknown as SupabaseClient)
      .from('note_document_edit_locks')
      .select(LOCK_SELECT)
      .eq('note_id', noteId)
      .maybeSingle();

    if (error) throw error;
    return data ? normalizeLock(data) : null;
  },

  acquire: async ({
    noteId,
    staffId,
    lockToken,
  }: {
    noteId: string;
    staffId: string;
    lockToken: string;
  }): Promise<NoteDocumentEditLock> => {
    const supabase = client();
    const { data, error } = await (supabase as unknown as SupabaseClient)
      .from('note_document_edit_locks')
      .upsert({
        note_id: noteId,
        locked_by: staffId,
        lock_token: lockToken,
        updated_at: new Date().toISOString(),
      })
      .select(LOCK_SELECT)
      .single();

    if (error) throw error;
    return normalizeLock(data);
  },

  heartbeat: async ({
    noteId,
    lockToken,
  }: {
    noteId: string;
    lockToken: string;
  }): Promise<void> => {
    const supabase = client();
    const { error } = await (supabase as unknown as SupabaseClient)
      .from('note_document_edit_locks')
      .update({ updated_at: new Date().toISOString() })
      .eq('note_id', noteId)
      .eq('lock_token', lockToken);

    if (error) throw error;
  },

  release: async ({
    noteId,
    lockToken,
  }: {
    noteId: string;
    lockToken: string;
  }): Promise<void> => {
    const supabase = client();
    const { error } = await (supabase as unknown as SupabaseClient)
      .from('note_document_edit_locks')
      .delete()
      .eq('note_id', noteId)
      .eq('lock_token', lockToken);

    if (error) throw error;
  },
};
