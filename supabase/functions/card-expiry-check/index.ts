// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

function json(resp: any, status = 200) {
  return new Response(JSON.stringify(resp), { 
    status, 
    headers: { 'Content-Type': 'application/json' } 
  });
}

Deno.serve(async (_req: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  try {
    // Get cards expiring in the next month
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const targetYear = nextMonth.getFullYear();
    const targetMonth = nextMonth.getMonth() + 1; // JavaScript months are 0-indexed

    console.log(`[card-expiry-check] Checking for cards expiring in ${targetMonth}/${targetYear}`);

    const { data: expiringCards, error: cardsErr } = await supabase
      .from('student_payment_methods')
      .select('id, student_id, card_brand, card_last4, card_exp_month, card_exp_year, stripe_payment_method_id')
      .eq('card_exp_year', targetYear)
      .eq('card_exp_month', targetMonth)
      .eq('is_default', true);

    if (cardsErr) throw cardsErr;

    if (!expiringCards || expiringCards.length === 0) {
      console.log('[card-expiry-check] No expiring cards found');
      return json({ ok: true, notified: 0 });
    }

    console.log(`[card-expiry-check] Found ${expiringCards.length} expiring cards`);

    // Get owned number for SMS
    const { data: ownedNum, error: ownedErr } = await supabase
      .from('owned_numbers')
      .select('id')
      .eq('is_default', true)
      .maybeSingle();

    if (ownedErr) throw ownedErr;

    if (!ownedNum) {
      console.error('[card-expiry-check] No default owned number configured');
      return json({ error: 'No owned number configured' }, 500);
    }

    let notified = 0;

    for (const card of expiringCards) {
      try {
        // Get student's contact info
        const { data: contact } = await supabase
          .from('contacts')
          .select('id, phone_e164')
          .eq('student_id', card.student_id)
          .maybeSingle();

        if (!contact?.phone_e164) {
          console.warn(`[card-expiry-check] No contact/phone for student ${card.student_id}`);
          continue;
        }

        // Find or create conversation
        let convoId: string | undefined;
        const { data: existing } = await supabase
          .from('conversations')
          .select('id')
          .eq('contact_id', contact.id)
          .eq('owned_number_id', ownedNum.id)
          .maybeSingle();

        if (existing) {
          convoId = existing.id;
        } else {
          const { data: newConvo } = await supabase
            .from('conversations')
            .insert({ 
              contact_id: contact.id, 
              owned_number_id: ownedNum.id, 
              status: 'OPEN' 
            })
            .select('id')
            .single();
          convoId = newConvo?.id;
        }

        if (!convoId) {
          console.warn(`[card-expiry-check] Failed to find/create conversation for student ${card.student_id}`);
          continue;
        }

        // Queue SMS notification
        const body = `Your payment card ending in ${card.card_last4} expires ${card.card_exp_month}/${card.card_exp_year}. Please update your payment method in the student portal to avoid payment issues.`;

        const { error: msgErr } = await supabase.from('messages').insert({
          conversation_id: convoId,
          body,
          direction: 'OUTGOING',
          status: 'QUEUED'
        });

        if (msgErr) {
          console.error(`[card-expiry-check] Failed to queue SMS for student ${card.student_id}:`, msgErr);
          continue;
        }

        console.log(`[card-expiry-check] Queued expiry SMS for student ${card.student_id}`);
        notified++;
      } catch (e: any) {
        console.error(`[card-expiry-check] Error processing card ${card.id}:`, e?.message || e);
      }
    }

    return json({ ok: true, notified, total: expiringCards.length });
  } catch (e: any) {
    console.error('[card-expiry-check] error', e?.message || e);
    return json({ error: 'card_expiry_check_error', message: String(e?.message || e) }, 500);
  }
});

