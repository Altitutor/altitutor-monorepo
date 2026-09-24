import type { Json } from '@altitutor/shared';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';

export type InvoiceOperatorEventName =
  | 'invoice.notification_sent'
  | 'invoice.payment_attempted';

type RecordInvoiceOperatorEventParams = {
  invoiceId: string;
  studentId?: string | null;
  eventName: InvoiceOperatorEventName;
  actorStaffId: string;
  payload?: Record<string, Json | undefined>;
};

function toJsonObject(payload: Record<string, Json | undefined> | undefined): Json {
  if (!payload) return {};
  return Object.fromEntries(
    Object.entries(payload).filter((entry): entry is [string, Json] => entry[1] !== undefined)
  );
}

/**
 * Record an Altitutor-owned invoice action. Stripe still owns paid/failed
 * outcomes via webhooks; this only captures staff send/charge attempts.
 */
export async function recordInvoiceOperatorEvent({
  invoiceId,
  studentId,
  eventName,
  actorStaffId,
  payload,
}: RecordInvoiceOperatorEventParams): Promise<void> {
  if (!supabaseAdmin) {
    console.error('[recordInvoiceOperatorEvent] Supabase admin client is not configured');
    return;
  }

  const { error } = await supabaseAdmin.rpc('record_domain_event', {
    p_event_name: eventName,
    p_subject_type: 'invoice',
    p_subject_id: invoiceId,
    p_entities: studentId
      ? [{ entity_type: 'student', entity_id: studentId, role: 'related' }]
      : [],
    p_payload: toJsonObject(payload),
    p_actor_staff_id: actorStaffId,
    p_source: 'application',
  });

  if (error) {
    console.error('[recordInvoiceOperatorEvent] Failed to record invoice activity', error);
  }
}
