import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { formatSessionType } from '@/shared/utils';
import { formatTime, getDayShortName } from '@/shared/utils/datetime';
import { formatInvoiceTagText } from '@/features/billing/utils/invoiceTagText';
import { getSessionTitle, type SessionWithDetails } from '@/features/sessions/utils/session-helpers';
import type { IssueTagInsert } from '../types';

type IssueTagDraft = Omit<IssueTagInsert, 'issue_id'>;

export function getTagEntity(tag: Partial<IssueTagInsert>): { type: string; id: string } | null {
  if (tag.student_id) return { type: 'student', id: tag.student_id };
  if (tag.staff_id) return { type: 'staff', id: tag.staff_id };
  if (tag.parent_id) return { type: 'parent', id: tag.parent_id };
  if (tag.class_id) return { type: 'class', id: tag.class_id };
  if (tag.session_id) return { type: 'session', id: tag.session_id };
  if (tag.invoice_id) return { type: 'invoice', id: tag.invoice_id };
  if (tag.subject_id) return { type: 'subject', id: tag.subject_id };
  return null;
}

export async function resolveTagLabels(tags: IssueTagDraft[]): Promise<Map<string, string>> {
  const labelMap = new Map<string, string>();
  const supabase = getSupabaseClient();

  const idsByType = {
    student: new Set<string>(),
    staff: new Set<string>(),
    parent: new Set<string>(),
    class: new Set<string>(),
    session: new Set<string>(),
    invoice: new Set<string>(),
    subject: new Set<string>(),
  };

  tags.forEach((tag) => {
    const entity = getTagEntity(tag);
    if (!entity) return;
    switch (entity.type) {
      case 'student':
        idsByType.student.add(entity.id);
        break;
      case 'staff':
        idsByType.staff.add(entity.id);
        break;
      case 'parent':
        idsByType.parent.add(entity.id);
        break;
      case 'class':
        idsByType.class.add(entity.id);
        break;
      case 'session':
        idsByType.session.add(entity.id);
        break;
      case 'invoice':
        idsByType.invoice.add(entity.id);
        break;
      case 'subject':
        idsByType.subject.add(entity.id);
        break;
      default:
        break;
    }
  });

  const studentIds = Array.from(idsByType.student);
  const staffIds = Array.from(idsByType.staff);
  const parentIds = Array.from(idsByType.parent);
  const classIds = Array.from(idsByType.class);
  const sessionIds = Array.from(idsByType.session);
  const invoiceIds = Array.from(idsByType.invoice);
  const subjectIds = Array.from(idsByType.subject);

  await Promise.all([
    (async () => {
      if (studentIds.length === 0) return;
      const { data } = await supabase.from('students').select('id, first_name, last_name').in('id', studentIds);
      (data ?? []).forEach((row) => {
        const label = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || row.id;
        labelMap.set(`student:${row.id}`, label);
      });
    })(),
    (async () => {
      if (staffIds.length === 0) return;
      const { data } = await supabase.from('staff').select('id, first_name, last_name').in('id', staffIds);
      (data ?? []).forEach((row) => {
        const label = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || row.id;
        labelMap.set(`staff:${row.id}`, label);
      });
    })(),
    (async () => {
      if (parentIds.length === 0) return;
      const { data } = await supabase.from('parents').select('id, first_name, last_name').in('id', parentIds);
      (data ?? []).forEach((row) => {
        const label = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || row.id;
        labelMap.set(`parent:${row.id}`, label);
      });
    })(),
    (async () => {
      if (subjectIds.length === 0) return;
      const { data } = await supabase.from('subjects').select('id, short_name, long_name, name').in('id', subjectIds);
      (data ?? []).forEach((row) => {
        const label = row.short_name || row.long_name || row.name || row.id;
        labelMap.set(`subject:${row.id}`, label);
      });
    })(),
    (async () => {
      if (classIds.length === 0) return;
      type ClassRow = {
        id: string;
        day_of_week: number | null;
        start_time: string | null;
        subject: { short_name?: string | null; long_name?: string | null; name?: string | null } | null;
      };
      const { data } = await supabase
        .from('classes')
        .select('id, day_of_week, start_time, subject:subjects(short_name, long_name, name)')
        .in('id', classIds);
      (data as ClassRow[] | null ?? []).forEach((row) => {
        const subject = row.subject;
        const subjectShort = subject?.short_name || subject?.long_name || subject?.name || '';
        const day = typeof row.day_of_week === 'number' ? getDayShortName(row.day_of_week) : '';
        const time = formatTime(row.start_time);
        const label = [subjectShort, day, time].filter(Boolean).join(' ') || row.id;
        labelMap.set(`class:${row.id}`, label);
      });
    })(),
    (async () => {
      if (sessionIds.length === 0) return;
      type SessionRow = {
        id: string;
        type: string | null;
        start_at: string | null;
        class:
          | {
              day_of_week: number | null;
              start_time: string | null;
              end_time: string | null;
              level: string | null;
              subject: {
                curriculum: string | null;
                year_level: number | null;
                name: string | null;
                short_name?: string | null;
                long_name?: string | null;
              } | null;
            }
          | null;
      };
      const { data } = await supabase
        .from('sessions')
        .select(
          'id, type, start_at, class:classes(day_of_week, start_time, end_time, level, subject:subjects(curriculum, year_level, name, short_name, long_name))'
        )
        .in('id', sessionIds);
      (data as SessionRow[] | null ?? []).forEach((row) => {
        const sessionLike = {
          id: row.id,
          type: row.type,
          class: row.class ?? undefined,
        } as unknown as SessionWithDetails;

        const title = getSessionTitle(sessionLike).trim();
        if (title) {
          labelMap.set(`session:${row.id}`, title);
          return;
        }

        const datePart = row.start_at ? new Date(row.start_at).toISOString().slice(0, 10) : '';
        const label = [formatSessionType(row.type), datePart].filter(Boolean).join(' ') || row.id;
        labelMap.set(`session:${row.id}`, label);
      });
    })(),
    (async () => {
      if (invoiceIds.length === 0) return;
      const [{ data: invoices }, { data: invoiceItems }] = await Promise.all([
        supabase.from('invoices').select('id, invoice_date, status').in('id', invoiceIds),
        supabase.from('invoice_items').select('invoice_id, description').in('invoice_id', invoiceIds),
      ]);

      const itemsByInvoiceId = new Map<string, string[]>();
      (invoiceItems ?? []).forEach((item) => {
        const current = itemsByInvoiceId.get(item.invoice_id) ?? [];
        current.push(item.description);
        itemsByInvoiceId.set(item.invoice_id, current);
      });

      (invoices ?? []).forEach((invoice) => {
        const label = formatInvoiceTagText({
          invoiceDate: invoice.invoice_date,
          lineItemDescriptions: itemsByInvoiceId.get(invoice.id) ?? [],
          status: invoice.status,
        });
        labelMap.set(`invoice:${invoice.id}`, label);
      });
    })(),
  ]);

  // Fallback to raw ids when lookup failed
  tags.forEach((tag) => {
    const entity = getTagEntity(tag);
    if (!entity) return;
    const key = `${entity.type}:${entity.id}`;
    if (!labelMap.has(key)) {
      labelMap.set(key, entity.id);
    }
  });

  return labelMap;
}
