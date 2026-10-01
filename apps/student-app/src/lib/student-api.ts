import type { Database, ResourceFile } from '@altitutor/shared';
import { displayResourceFilename, formatResourceTypeLabel, mapTopicFile } from '@altitutor/shared';

import { startOfAdelaideDay } from '@/features/dashboard/timetable';
import { studentWebUrl } from '@/lib/student-web';
import { supabase } from '@/lib/supabase';
export { readPaymentMethod, type PaymentMethod } from '@/lib/payment-method';

export type StudentSession = Database['public']['Views']['vstudent_session_base']['Row'];
export type StudentClass = Database['public']['Views']['vstudent_classes']['Row'];
export type StudentClassDetail = Database['public']['Views']['vstudent_class_detail']['Row'];
export type StudentProfile = Database['public']['Views']['vstudent_profile']['Row'];
export type StudentBilling = Database['public']['Views']['vstudent_billing']['Row'];
export type StudentInvoice = Database['public']['Views']['vstudent_invoices']['Row'];
export type StudentInvoiceItem = Database['public']['Views']['vstudent_invoice_items']['Row'];
export type StudentInvoiceWithItems = StudentInvoice & { items: StudentInvoiceItem[] };
export type StudentSubscription = Database['public']['Views']['vstudent_subscriptions']['Row'];
export type StudentSubscriptionWithSubject = StudentSubscription & {
  subject: Pick<ResourceSubject, 'name' | 'short_name' | 'long_name'> | null;
};
export type StudentSessionDetail = Database['public']['Views']['vstudent_session_detail']['Row'];
export type ResourceSubject = Database['public']['Views']['vstudent_online_subjects']['Row'];
export type ResourceTopic = Database['public']['Views']['vstudent_topics']['Row'];

export type RecentResource = {
  id: string;
  topicId: string;
  title: string;
  detail: string | null;
};

const RECENT_RESOURCE_LIMIT = 4;

export type StudentNotification = {
  id: string;
  title: string | null;
  body: string | null;
  created_at: string | null;
  read_at: string | null;
  action_url: string | null;
};

export type NotificationPatch = {
  notificationIds?: string[];
  markAllRead?: boolean;
  markUnread?: boolean;
  dismiss?: boolean;
};

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function toRecentResource(row: {
  id: string | null;
  filename: string | null;
  topic_id: string | null;
  type: string | null;
  code: string | null;
}): RecentResource | null {
  if (!row.id || !row.topic_id || !row.filename) return null;
  return {
    id: row.id,
    topicId: row.topic_id,
    title: displayResourceFilename(row.filename),
    detail: row.type ? formatResourceTypeLabel(row.type) : row.code,
  };
}

function tutorLogFileIds(raw: Database['public']['Views']['vstudent_tutor_log']['Row']['files']): string[] {
  if (!Array.isArray(raw)) return [];
  const ids: string[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const record = entry as { [key: string]: unknown };
    if (typeof record.topics_files_id === 'string') ids.push(record.topics_files_id);
  }
  return ids;
}

async function recentResourcesFromTutorLogs(): Promise<RecentResource[]> {
  const { data, error } = await supabase
    .from('vstudent_tutor_log')
    .select('files, tutor_log_updated_at')
    .not('files', 'is', null)
    .order('tutor_log_updated_at', { ascending: false })
    .limit(12);
  throwIfError(error);
  const ids: string[] = [];
  for (const log of data ?? []) {
    for (const id of tutorLogFileIds(log.files)) {
      if (ids.includes(id)) continue;
      ids.push(id);
      if (ids.length >= RECENT_RESOURCE_LIMIT) break;
    }
    if (ids.length >= RECENT_RESOURCE_LIMIT) break;
  }
  if (ids.length === 0) return [];
  const files = await supabase
    .from('vstudent_topics_files')
    .select('id, filename, topic_id, type, code')
    .in('id', ids);
  throwIfError(files.error);
  const byId = new Map((files.data ?? []).map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    const resource = row ? toRecentResource(row) : null;
    return resource ? [resource] : [];
  });
}

export const studentApi = {
  async listUpcomingSessions(): Promise<StudentSession[]> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('vstudent_session_base')
      .select('*')
      .gte('start_at', now)
      .order('start_at', { ascending: true })
      .limit(60);
    throwIfError(error);
    return data ?? [];
  },

  async listDashboardSessions(): Promise<StudentSession[]> {
    const { data, error } = await supabase
      .from('vstudent_session_base')
      .select('*')
      .gte('start_at', startOfAdelaideDay().toISOString())
      .order('start_at', { ascending: true })
      .limit(40);
    throwIfError(error);
    return data ?? [];
  },

  async listRecentResources(): Promise<RecentResource[]> {
    const { data, error } = await supabase
      .from('vstudent_topics_files')
      .select('id, filename, topic_id, type, code')
      .order('created_at', { ascending: false })
      .limit(RECENT_RESOURCE_LIMIT);
    throwIfError(error);
    const files = (data ?? []).flatMap((row) => {
      const resource = toRecentResource(row);
      return resource ? [resource] : [];
    });
    if (files.length > 0) return files;
    return recentResourcesFromTutorLogs();
  },

  async listClasses(): Promise<StudentClass[]> {
    const { data, error } = await supabase.from('vstudent_classes').select('*').order('day_of_week');
    throwIfError(error);
    return data ?? [];
  },

  async getClass(classId: string): Promise<StudentClassDetail | null> {
    const { data, error } = await supabase
      .from('vstudent_class_detail')
      .select('*')
      .eq('class_id', classId)
      .maybeSingle();
    throwIfError(error);
    return data;
  },

  async listClassSessions(classId: string): Promise<StudentSession[]> {
    const { data, error } = await supabase
      .from('vstudent_session_base')
      .select('*')
      .eq('class_id', classId)
      .order('start_at', { ascending: false })
      .limit(20);
    throwIfError(error);
    return data ?? [];
  },

  async getSession(sessionId: string): Promise<StudentSessionDetail | null> {
    const { data, error } = await supabase
      .from('vstudent_session_detail')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();
    throwIfError(error);
    return data;
  },

  async listSubjects(): Promise<ResourceSubject[]> {
    const { data, error } = await supabase.from('vstudent_online_subjects').select('*').order('name');
    throwIfError(error);
    return data ?? [];
  },

  async listTopics(subjectId: string): Promise<ResourceTopic[]> {
    const { data, error } = await supabase
      .from('vstudent_topics')
      .select('*')
      .eq('subject_id', subjectId)
      .order('index');
    throwIfError(error);
    return data ?? [];
  },

  async listFiles(topicId: string): Promise<ResourceFile[]> {
    const { data, error } = await supabase
      .from('vstudent_topics_files')
      .select('*')
      .eq('topic_id', topicId)
      .order('index');
    throwIfError(error);
    return (data ?? []).map(mapTopicFile).filter((file): file is ResourceFile => file !== null);
  },

  async listFilesForTopics(topicIds: string[]): Promise<ResourceFile[]> {
    if (topicIds.length === 0) return [];
    const { data, error } = await supabase
      .from('vstudent_topics_files')
      .select('*')
      .in('topic_id', topicIds)
      .order('index');
    throwIfError(error);
    return (data ?? []).map(mapTopicFile).filter((file): file is ResourceFile => file !== null);
  },

  async getFileUrl(file: ResourceFile): Promise<string | null> {
    if (file.externalUrl) return file.externalUrl;
    if (!file.bucket || !file.storagePath) return null;
    const { data, error } = await supabase.storage.from(file.bucket).createSignedUrl(file.storagePath, 3600);
    throwIfError(error);
    return data?.signedUrl ?? null;
  },

  async getBilling(): Promise<StudentBilling | null> {
    const { data, error } = await supabase.from('vstudent_billing').select('*').maybeSingle();
    throwIfError(error);
    return data;
  },

  async listInvoices(limit = 6): Promise<StudentInvoiceWithItems[]> {
    const { data, error } = await supabase
      .from('vstudent_invoices')
      .select('*')
      .order('invoice_date', { ascending: false })
      .limit(limit);
    throwIfError(error);
    const invoices = data ?? [];
    const ids = invoices.map((invoice) => invoice.id).filter((id): id is string => Boolean(id));
    if (ids.length === 0) return invoices.map((invoice) => ({ ...invoice, items: [] }));
    const { data: items, error: itemsError } = await supabase
      .from('vstudent_invoice_items')
      .select('*')
      .in('invoice_id', ids)
      .order('session_start_at');
    throwIfError(itemsError);
    return invoices.map((invoice) => ({
      ...invoice,
      items: (items ?? []).filter((item) => item.invoice_id === invoice.id),
    }));
  },

  async listSubscriptions(): Promise<StudentSubscriptionWithSubject[]> {
    const { data, error } = await supabase
      .from('vstudent_subscriptions')
      .select('*')
      .order('updated_at', { ascending: false });
    throwIfError(error);
    const subscriptions = data ?? [];
    const subjectIds = subscriptions
      .map((subscription) => subscription.subject_id)
      .filter((id): id is string => Boolean(id));
    if (subjectIds.length === 0) {
      return subscriptions.map((subscription) => ({ ...subscription, subject: null }));
    }
    const { data: subjects, error: subjectsError } = await supabase
      .from('vstudent_subscription_subjects')
      .select('id, name, short_name, long_name')
      .in('id', subjectIds);
    throwIfError(subjectsError);
    const subjectsById = new Map(
      (subjects ?? []).flatMap((subject) => subject.id ? [[subject.id, subject]] : []),
    );
    return subscriptions.map((subscription) => ({
      ...subscription,
      subject: subscription.subject_id ? subjectsById.get(subscription.subject_id) ?? null : null,
    }));
  },

  async getProfile(): Promise<StudentProfile | null> {
    const { data, error } = await supabase.from('vstudent_profile').select('*').maybeSingle();
    throwIfError(error);
    return data;
  },

  async listNotifications(): Promise<StudentNotification[]> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('vstudent_notifications')
      .select('id, title, body, created_at, read_at, action_url')
      .is('dismissed_at', null)
      .is('resolved_at', null)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('created_at', { ascending: false })
      .limit(50);
    throwIfError(error);
    return (data ?? []).flatMap((row) => (row.id ? [{
      id: row.id,
      title: row.title,
      body: row.body,
      created_at: row.created_at,
      read_at: row.read_at,
      action_url: row.action_url,
    }] : []));
  },

  async patchNotifications(body: NotificationPatch): Promise<void> {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session) throw new Error('Please sign in to continue.');
    const response = await fetch(studentWebUrl('/api/notifications'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.session.access_token}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error('Unable to update notifications.');
  },
};
