import { useQuery } from '@tanstack/react-query';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { getInviteUrlForStaff } from '@/shared/utils/invites';

export interface StaffInviteTokenData {
  token: string | null;
  inviteUrl: string | null;
}

async function fetchStaffInviteToken(
  staffId: string,
  role: string
): Promise<StaffInviteTokenData> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;

  const { data, error } = await supabase
    .from('staff')
    .select('invite_token')
    .eq('id', staffId)
    .single();

  if (error || !data?.invite_token) {
    return { token: null, inviteUrl: null };
  }

  const inviteUrl = getInviteUrlForStaff(data.invite_token, role);
  return { token: data.invite_token, inviteUrl };
}

export const staffInviteTokenKeys = {
  all: ['staff-invite-token'] as const,
  detail: (staffId: string, role: string) =>
    [...staffInviteTokenKeys.all, staffId, role] as const,
};

/**
 * React Query hook for staff invite token.
 * Replaces useEffect-based fetching in SendInviteDialog.
 */
export function useStaffInviteToken(
  staffId: string | undefined,
  role: string,
  enabled: boolean
) {
  return useQuery({
    queryKey: staffInviteTokenKeys.detail(staffId ?? '', role),
    queryFn: () => fetchStaffInviteToken(staffId!, role),
    enabled: enabled && !!staffId,
    staleTime: 1000 * 60, // 1 minute
  });
}
