import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { automationRecoverySchema } from '../types/automationRecovery';
import { messagesKeys } from './queryKeys';

async function responseBody(response: Response): Promise<unknown> {
  const body: unknown = await response.json();
  if (!response.ok) {
    throw new Error(typeof body === 'object' && body && 'error' in body && typeof body.error === 'string'
      ? body.error : 'Could not load the recovery. Refresh and review the current result.');
  }
  return body;
}
export function useAutomationRecovery(messageId: string | null) {
  return useQuery({
    queryKey: [...messagesKeys.all, 'automation-recovery', messageId],
    enabled: Boolean(messageId), retry: false,
    queryFn: async () => automationRecoverySchema.parse(await responseBody(await fetch(
      `/api/messages/automation-recovery?message=${encodeURIComponent(messageId ?? '')}`,
      { cache: 'no-store' },
    ))),
  });
}
export function useRecoverAutomationMessage() {
  const client = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: async (preview: {messageId:string;contactId:string;destination:string;expectedRecoveryId:string|null}) =>
      responseBody(await fetch('/api/messages/automation-recovery', {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(preview),
      })),
    onSettled: async () => {
      await Promise.all([
        client.invalidateQueries({queryKey:messagesKeys.all}),
        client.invalidateQueries({queryKey:['notifications']}),
        client.invalidateQueries({queryKey:['entity-communication','messages']}),
      ]);
    },
  });
}
