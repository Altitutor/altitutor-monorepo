import { getSupabaseClient } from '@/shared/lib/supabase/client';

export interface DeletedBusinessRecord {
  kind: string;
  id: string;
  name: string;
  deleted_at: string;
  can_restore: boolean;
}

export async function listDeletedBusinessRecords(): Promise<DeletedBusinessRecord[]> {
  const { data, error } = await getSupabaseClient().rpc('deleted_business_records');
  if (error) throw error;
  return data ?? [];
}

export async function restoreBusinessRecord(record: Pick<DeletedBusinessRecord, 'kind' | 'id'>): Promise<void> {
  const { error } = await getSupabaseClient().rpc('restore_business_record', { p_kind: record.kind, p_id: record.id });
  if (error) throw error;
}
