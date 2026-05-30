import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';
import type { StaffTierProgress } from '@altitutor/shared/pay-tiers';

export const PAY_TIER_ELIGIBLE_NOTIFICATION_TYPE = 'PAY_TIER_ELIGIBLE';

type AdminClient = SupabaseClient<Database>;

function buildEligibilityCopy(progress: StaffTierProgress): {
  title: string;
  body: string;
  actionUrl: string;
} {
  const { currentTierNumber, nextTierNumber } = progress;
  return {
    title: 'You have met the requirements for this tier',
    body: `You are eligible for a tier review check-in to advance from Tier ${currentTierNumber} to Tier ${nextTierNumber}.`,
    actionUrl: '/pay-tier',
  };
}

/**
 * Keeps a single unread PAY_TIER_ELIGIBLE notification in sync with current eligibility.
 * Uses service role — call only from authorized server routes.
 */
export async function ensurePayTierEligibilityNotification(
  admin: AdminClient,
  progress: StaffTierProgress
): Promise<void> {
  const { staffId, isEligibleForReview, nextTierNumber } = progress;
  const now = new Date().toISOString();

  if (!isEligibleForReview || !nextTierNumber) {
    await admin
      .from('notifications')
      .update({ read_at: now })
      .eq('staff_id', staffId)
      .eq('notification_type', PAY_TIER_ELIGIBLE_NOTIFICATION_TYPE)
      .is('read_at', null);
    return;
  }

  const { title, body, actionUrl } = buildEligibilityCopy(progress);

  const { data: existing, error: fetchError } = await admin
    .from('notifications')
    .select('id, body')
    .eq('staff_id', staffId)
    .eq('notification_type', PAY_TIER_ELIGIBLE_NOTIFICATION_TYPE)
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (existing) {
    if (existing.body === body) return;
    const { error: updateError } = await admin
      .from('notifications')
      .update({ title, body, action_url: actionUrl })
      .eq('id', existing.id);
    if (updateError) throw updateError;
    return;
  }

  const { error: insertError } = await admin.from('notifications').insert({
    staff_id: staffId,
    notification_type: PAY_TIER_ELIGIBLE_NOTIFICATION_TYPE,
    title,
    body,
    action_url: actionUrl,
  });

  if (insertError) throw insertError;
}
