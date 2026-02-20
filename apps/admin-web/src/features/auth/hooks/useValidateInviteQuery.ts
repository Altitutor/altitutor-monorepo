import { useQuery } from '@tanstack/react-query';
import { invitesApi, type ValidateInviteResponse } from '../api/invites';

export const inviteKeys = {
  all: ['invite'] as const,
  validate: (token: string) => [...inviteKeys.all, 'validate', token] as const,
};

/**
 * Validates an invite token. Use for accept-invite page to check token and pre-fill email.
 */
export function useValidateInviteQuery(token: string) {
  return useQuery({
    queryKey: inviteKeys.validate(token),
    queryFn: (): Promise<ValidateInviteResponse> => invitesApi.validateInvite(token),
    enabled: !!token,
    staleTime: 2 * 60 * 1000, // 2 minutes - token validation is stable for the page session
  });
}
