import { getUpcomingUnassignedClassIds } from '@/features/classes/api/unassignedClasses';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { loadStudentsWithoutClasses } from './studentsWithoutClasses';
import type { Database } from '@altitutor/shared';
import { tasksApi } from '@/features/tasks/api/tasks';
import type {
  UninvoicedSession,
  UnloggedSession,
  UnassignedClass,
  UnpaidInvoice,
  StudentWithoutPaymentMethod,
  UnassignedTask,
  VoidInvoiceSession,
  ProjectWithoutLead,
  ReconciliationTabCounts,
  SessionBillingAdjustmentIssue,
} from '../types';

// Helper type for querying views
type ViewQueryResult<T> = {
  data: T[] | null;
  error: Error | null;
};

type ViewSelectChain = {
  order: (column: string, options: { ascending: boolean }) => ViewSelectChain;
} & Promise<ViewQueryResult<unknown>>;

type ViewQueryBuilder = {
  select: (columns: string) => ViewSelectChain;
};

type SupabaseWithViews = SupabaseClient<Database> & {
  from: (table: string) => ViewQueryBuilder;
};

type ViewCountBuilder = {
  select: (
    columns: string,
    options: { count: 'exact'; head: true },
  ) => Promise<{ count: number | null; error: Error | null }>;
};

type SupabaseWithViewCounts = SupabaseClient<Database> & {
  from: (table: string) => ViewCountBuilder;
};

/** Rows from reconciliation views that carry session_id + optional view/session labels. */
type ReconciliationSessionRow = {
  session_id: string;
  session_name?: string | null;
  session_short_name?: string | null;
};

/**
 * Prefer live `sessions.short_name`, then `sessions.long_name`, then any view `session_short_name`,
 * then composite `session_name`.
 */
async function enrichReconciliationSessionRows<T extends ReconciliationSessionRow>(
  supabase: SupabaseClient<Database>,
  rows: T[],
): Promise<T[]> {
  const sessionIds = [
    ...new Set(rows.map((r) => r.session_id).filter((id): id is string => typeof id === 'string' && id.length > 0)),
  ];
  if (sessionIds.length === 0) return rows;

  const { data: sessionRows, error } = await supabase
    .from('sessions')
    .select('id, short_name, long_name')
    .in('id', sessionIds);
  if (error) throw error;

  const byId = new Map((sessionRows ?? []).map((s) => [s.id, s]));

  return rows.map((row) => {
    const s = byId.get(row.session_id);
    const fromView = row.session_short_name?.trim();
    const fromSessionShort = s?.short_name?.trim();
    const fromSessionLong = s?.long_name?.trim();
    const merged = fromSessionShort || fromSessionLong || fromView || row.session_name?.trim() || null;
    return { ...row, session_short_name: merged || null } as T;
  });
}

function parseAssignedTutorsFromView(raw: unknown): UnloggedSession['assigned_tutors'] {
  if (raw == null) return null;
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  if (!Array.isArray(parsed)) return null;
  if (parsed.length === 0) return [];
  return parsed as NonNullable<UnloggedSession['assigned_tutors']>;
}

/**
 * Reconciliation API client for querying reconciliation views
 */
export const reconciliationApi = {
  getSessionBillingAdjustmentIssues: async (): Promise<SessionBillingAdjustmentIssue[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase
      .from('vadmin_reconciliation_session_billing_adjustments')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as SessionBillingAdjustmentIssue[];
  },

  /**
   * Get uninvoiced sessions
   */
  getUninvoicedSessions: async (): Promise<UninvoicedSession[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await (supabase as unknown as SupabaseWithViews)
      .from('vadmin_reconciliation_uninvoiced_sessions')
      .select('*')
      .order('session_start_at', { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as UninvoicedSession[];
    return enrichReconciliationSessionRows(supabase, rows);
  },

  /**
   * Get unpaid invoices
   */
  getUnpaidInvoices: async (): Promise<UnpaidInvoice[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase
      .from('invoices')
      .select(
        `
        id,
        student_id,
        invoice_date,
        status,
        amount_due_cents,
        currency,
        stripe_invoice_id,
        stripe_invoice_number,
        collection_method,
        metadata,
        student:students!invoices_student_id_fkey (
          first_name,
          last_name,
          email
        ),
        invoice_items (
          session_id,
          deleted_at,
          sessions (
            start_at,
            short_name,
            long_name
          )
        )
      `,
      )
      .neq('status', 'paid')
      .neq('status', 'void')
      .neq('status', 'uncollectible')
      .gt('amount_due_cents', 0)
      .is('deleted_at', null)
      .order('invoice_date', { ascending: true });

    if (error) throw error;

    // Transform the data to match UnpaidInvoice type
    type InvoiceQueryResult = {
      id: string;
      student_id: string;
      invoice_date: string;
      status: string;
      amount_due_cents: number;
      currency: string;
      stripe_invoice_id: string | null;
      stripe_invoice_number: string | null;
      collection_method: string | null;
      metadata: unknown;
      student: {
        first_name: string | null;
        last_name: string | null;
        email: string | null;
      } | null;
      invoice_items?:
        | {
            session_id: string | null;
            deleted_at: string | null;
            sessions: {
              start_at: string | null;
              short_name: string | null;
              long_name: string | null;
            } | null;
          }[]
        | null;
    };

    return (data ?? []).map((invoice: InvoiceQueryResult) => {
      const student = invoice.student;
      const firstLine = (invoice.invoice_items ?? []).find((row) => row.session_id && row.deleted_at == null);
      const lineSessionId = firstLine?.session_id ?? null;
      const sessionStartAt = firstLine?.sessions?.start_at ?? null;
      const sessionShortName =
        firstLine?.sessions?.short_name?.trim() || firstLine?.sessions?.long_name?.trim() || null;
      type InvoiceMetadata = {
        last_payment_error?: {
          code: string;
          message: string;
          type: string;
        } | null;
      };
      const metadata = (invoice.metadata as InvoiceMetadata | null) ?? null;
      const lastPaymentError = metadata?.last_payment_error || null;

      return {
        id: invoice.id,
        student_id: invoice.student_id,
        invoice_date: invoice.invoice_date,
        due_date: null, // invoices table doesn't have due_date column
        status: invoice.status,
        amount_due_cents: invoice.amount_due_cents,
        currency: invoice.currency,
        stripe_invoice_id: invoice.stripe_invoice_id,
        stripe_invoice_number: invoice.stripe_invoice_number,
        collection_method: invoice.collection_method,
        last_payment_error: lastPaymentError,
        student_first_name: student?.first_name || null,
        student_last_name: student?.last_name || null,
        student_email: student?.email || null,
        days_overdue: null, // Cannot calculate without due_date
        session_id: lineSessionId,
        session_start_at: sessionStartAt,
        session_short_name: sessionShortName,
      } as UnpaidInvoice;
    });
  },

  /**
   * Get unlogged sessions (single query via vadmin_reconciliation_unlogged_sessions).
   */
  getUnloggedSessions: async (): Promise<UnloggedSession[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await (supabase as unknown as SupabaseWithViews)
      .from('vadmin_reconciliation_unlogged_sessions')
      .select('*')
      .order('start_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      const dow = r.day_of_week;
      return {
        session_id: String(r.session_id),
        start_at: String(r.start_at ?? ''),
        end_at: (r.end_at as string | null) ?? null,
        session_type: String(r.session_type ?? ''),
        session_name: String(r.session_name ?? 'Session'),
        subject_id: (r.subject_id as string | null) ?? null,
        subject_name: (r.subject_name as string | null) ?? null,
        class_id: (r.class_id as string | null) ?? null,
        day_of_week: typeof dow === 'number' ? dow : dow != null ? Number(dow) : null,
        class_start_time: (r.class_start_time as string | null) ?? null,
        class_end_time: (r.class_end_time as string | null) ?? null,
        assigned_tutors: parseAssignedTutorsFromView(r.assigned_tutors),
        student_count: Number(r.student_count ?? 0),
        created_at: String(r.created_at ?? ''),
        updated_at: String(r.updated_at ?? ''),
      } as UnloggedSession;
    });
  },

  /**
   * Get unassigned classes (single query via vadmin_reconciliation_unassigned_classes).
   */
  getUnassignedClasses: async (): Promise<UnassignedClass[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await (supabase as unknown as SupabaseWithViews)
      .from('vadmin_reconciliation_unassigned_classes')
      .select('*')
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        class_id: String(r.class_id),
        class_display_name: String(r.class_display_name ?? 'Class'),
        subject_id: (r.subject_id as string | null) ?? null,
        subject_name: (r.subject_name as string | null) ?? null,
        day_of_week: Number(r.day_of_week),
        start_time: String(r.start_time ?? ''),
        end_time: String(r.end_time ?? ''),
        class_status: String(r.class_status ?? ''),
        room: (r.room as string | null) ?? null,
        level: (r.level as string | null) ?? null,
        student_count: Number(r.student_count ?? 0),
        created_at: String(r.created_at ?? ''),
        updated_at: String(r.updated_at ?? ''),
      } as UnassignedClass;
    });
  },

  /**
   * Get unassigned tasks (tasks with no assignee)
   */
  getUnassignedTasks: async (): Promise<UnassignedTask[]> => {
    const tasks = await tasksApi.list({
      unassignedOnly: true,
      status: ['backlog', 'todo', 'in_progress', 'in_review'],
    });
    return tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      due_date: t.due_date,
      created_at: t.created_at ?? '',
      updated_at: t.updated_at ?? '',
      issue: t.issue ?? null,
      project: t.project ?? null,
    }));
  },

  /**
   * Active projects with no project lead (excludes completed).
   */
  getProjectsWithNoLead: async (): Promise<ProjectWithoutLead[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase
      .from('projects')
      .select(
        `
        id,
        name,
        status,
        priority,
        target_date,
        created_at,
        updated_at,
        creator:staff!projects_created_by_fkey(id, first_name, last_name)
      `,
      )
      .is('project_lead_id', null)
      .neq('status', 'completed')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as unknown as ProjectWithoutLead[];
  },

  /**
   * ACTIVE students with no `student_payment_methods` rows (via reconciliation view).
   * RLS on underlying tables still applies; ADMINSTAFF is required for payment-method data.
   */
  getStudentsWithoutPaymentMethod: async (): Promise<StudentWithoutPaymentMethod[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await (supabase as unknown as SupabaseWithViews)
      .from('vadmin_reconciliation_students_without_payment_method')
      .select('*')
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true });
    if (error) throw error;
    return (data ?? []) as StudentWithoutPaymentMethod[];
  },

  getVoidInvoiceSessions: async (): Promise<VoidInvoiceSession[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await (supabase as unknown as SupabaseWithViews)
      .from('vadmin_reconciliation_void_invoice_sessions')
      .select('*')
      .order('session_start_at', { ascending: false });
    if (error) throw error;

    const rows = (data ?? []) as VoidInvoiceSession[];
    return enrichReconciliationSessionRows(supabase, rows);
  },
};

async function countReconciliationViewRows(viewName: string): Promise<number> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const { count, error } = await (supabase as unknown as SupabaseWithViewCounts)
    .from(viewName)
    .select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}

async function countUnpaidInvoicesExact(): Promise<number> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const { count, error } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .neq('status', 'paid')
    .neq('status', 'void')
    .neq('status', 'uncollectible')
    .gt('amount_due_cents', 0)
    .is('deleted_at', null);
  if (error) throw error;
  return count ?? 0;
}

async function countUnassignedTasksExact(): Promise<number> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const { count, error } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .is('assigned_to', null)
    .in('status', ['backlog', 'todo', 'in_progress', 'in_review']);
  if (error) throw error;
  return count ?? 0;
}

async function countProjectsWithoutLeadExact(): Promise<number> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const { count, error } = await supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .is('project_lead_id', null)
    .neq('status', 'completed');
  if (error) throw error;
  return count ?? 0;
}

/**
 * Parallel counts for reconciliation tab badges. Uses exact `COUNT` / head requests where possible
 * so badges do not re-fetch full reconciliation lists (scheduling counts use restored DB views).
 */
export async function getReconciliationTabCounts(): Promise<ReconciliationTabCounts> {
  const [
    uninvoicedCount,
    voidCount,
    unpaidCount,
    noPaymentCount,
    unloggedCount,
    unassignedClassesCount,
    studentsWithoutClassesCount,
    unassignedTasksCount,
    projectsNoLeadCount,
    sessionBillingAdjustmentsCount,
  ] = await Promise.all([
    countReconciliationViewRows('vadmin_reconciliation_uninvoiced_sessions'),
    countReconciliationViewRows('vadmin_reconciliation_void_invoice_sessions'),
    countUnpaidInvoicesExact(),
    countReconciliationViewRows('vadmin_reconciliation_students_without_payment_method'),
    countReconciliationViewRows('vadmin_reconciliation_unlogged_sessions'),
    getUpcomingUnassignedClassIds().then((ids) => ids.size),
    loadStudentsWithoutClasses(getSupabaseClient()).then((rows) => new Set(rows.map((row) => row.student_id)).size),
    countUnassignedTasksExact(),
    countProjectsWithoutLeadExact(),
    countReconciliationViewRows('vadmin_reconciliation_session_billing_adjustments'),
  ]);

  return {
    financial: uninvoicedCount + voidCount + unpaidCount + noPaymentCount + sessionBillingAdjustmentsCount,
    scheduling: unloggedCount + unassignedClassesCount + studentsWithoutClassesCount,
    operations: unassignedTasksCount + projectsNoLeadCount,
  };
}
