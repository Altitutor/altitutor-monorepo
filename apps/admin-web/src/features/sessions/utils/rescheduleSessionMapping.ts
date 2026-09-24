import type { Tables } from '@altitutor/shared';
import type { RescheduleSession } from '../types/absence';

export type RpcRescheduleRow = {
  id?: string;
  start_at?: string | null;
  end_at?: string | null;
  class_id?: string | null;
  type?: Tables<'sessions'>['type'] | null;
  status?: string | null;
  billing_type?: Tables<'sessions'>['billing_type'] | null;
  subject_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  long_name?: string | null;
  short_name?: string | null;
  room?: string | null;
  class?: (Partial<Tables<'classes'>> & { subject?: Tables<'subjects'> | null }) | null;
  subject?: Partial<Tables<'subjects'>> | null;
  studentCount?: number;
};

export function parseRescheduleSessionsRpc(data: unknown): RpcRescheduleRow[] {
  if (!data) return [];

  let sessions: unknown = data;
  if (typeof data === 'string') {
    try {
      sessions = JSON.parse(data) as unknown;
    } catch (e) {
      console.error('Error parsing RPC response:', e);
      return [];
    }
  }

  if (!Array.isArray(sessions)) {
    if (sessions && typeof sessions === 'object' && 'error' in sessions) {
      console.error('RPC returned error:', (sessions as { error: unknown }).error);
    }
    return [];
  }

  return sessions as RpcRescheduleRow[];
}

export function mapRescheduleSessionsFromRpc(data: unknown): RescheduleSession[] {
  return parseRescheduleSessionsRpc(data).flatMap((rpc) => {
    if (!rpc.id) return [];

    const classData = rpc.class ?? null;
    const nestedSubject =
      classData && 'subject' in classData ? classData.subject : null;
    const subject =
      nestedSubject ?? (rpc.subject as Tables<'subjects'> | null | undefined) ?? null;

    return [
      {
        ...rpc,
        id: rpc.id,
        start_at: rpc.start_at ?? null,
        end_at: rpc.end_at ?? null,
        class_id: rpc.class_id ?? null,
        type: (rpc.type ?? 'CLASS') as Tables<'sessions'>['type'],
        status: rpc.status ?? 'SCHEDULED',
        billing_type: rpc.billing_type ?? null,
        subject_id: rpc.subject_id ?? classData?.subject_id ?? null,
        created_at: rpc.created_at ?? null,
        updated_at: rpc.updated_at ?? null,
        long_name: rpc.long_name ?? null,
        short_name: rpc.short_name ?? null,
        room: rpc.room ?? classData?.room ?? null,
        class: (classData as Tables<'classes'> | null) ?? null,
        subject,
        studentCount: rpc.studentCount ?? 0,
      } as RescheduleSession,
    ];
  });
}
