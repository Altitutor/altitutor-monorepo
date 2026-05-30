import type { Database, ResourceFile } from '@altitutor/shared';
import { mapTopicFile } from '@altitutor/shared';

import { supabase } from '@/lib/supabase';

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
export type ResourceSubject = Database['public']['Views']['vstudent_subjects']['Row'];
export type ResourceTopic = Database['public']['Views']['vstudent_topics']['Row'];

export type PaymentMethod = {
  id: string;
  card_brand: string;
  card_last4: string;
  card_exp_month: number;
  card_exp_year: number;
  is_default?: boolean;
};

export type StudentProfileUpdate = Pick<
  Database['public']['Tables']['students']['Update'],
  'first_name' | 'last_name' | 'phone'
>;

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
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
    const { data, error } = await supabase.from('vstudent_subjects').select('*').order('name');
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
      .from('vstudent_subjects')
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

  async updateProfile(studentId: string, updates: StudentProfileUpdate): Promise<void> {
    const { error } = await supabase.from('students').update(updates).eq('id', studentId);
    throwIfError(error);
  },
};

export function readPaymentMethod(billing: StudentBilling | null | undefined): PaymentMethod | null {
  const value = billing?.default_payment_method;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.card_last4 !== 'string' || typeof row.card_brand !== 'string') return null;
  return {
    id: String(row.id ?? ''),
    card_brand: row.card_brand,
    card_last4: row.card_last4,
    card_exp_month: Number(row.card_exp_month ?? 0),
    card_exp_year: Number(row.card_exp_year ?? 0),
    is_default: Boolean(row.is_default),
  };
}
