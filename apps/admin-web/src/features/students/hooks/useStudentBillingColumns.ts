import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { currentSubsidies } from '../api/currentSubsidies';

export function useStudentBillingColumns(ids: string[], columns: string[]) {
  const payments = columns.includes('payment_method');
  const subsidies = columns.includes('subsidies');
  return useQuery({
    queryKey: ['students', 'billing-columns', ids, payments, subsidies],
    enabled: ids.length > 0 && (payments || subsidies),
    queryFn: async () => {
      const db = getSupabaseClient();
      const [cards, rates] = await Promise.all([
        payments ? db.from('student_payment_methods').select('student_id, card_brand, card_last4')
          .in('student_id', ids).order('is_default', { ascending: false }).order('created_at') : null,
        subsidies ? currentSubsidies(db).in('student_id', ids).order('effective_from', { ascending: false }) : null,
      ]);
      if (cards?.error) throw cards.error;
      if (rates?.error) throw rates.error;
      const paymentById: Record<string, string> = {};
      for (const card of cards?.data ?? []) {
        paymentById[card.student_id] ??= `${card.card_brand} •••• ${card.card_last4}`;
      }
      const subsidiesById: Record<string, Array<{ id: string; label: string }>> = {};
      for (const rate of rates?.data ?? []) {
        const price = new Intl.NumberFormat('en-AU', { style: 'currency', currency: rate.currency }).format(rate.price_cents / 100);
        (subsidiesById[rate.student_id] ??= []).push({
          id: rate.id,
          label: `${rate.subject?.name ?? 'Subject'} · ${rate.billing_type.replaceAll('_', ' ').toLowerCase()} · ${price}`,
        });
      }
      return { paymentById, subsidiesById };
    },
  });
}
