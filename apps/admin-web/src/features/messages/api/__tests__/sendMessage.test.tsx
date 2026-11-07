import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useAuthStore, type User } from '@/shared/lib/supabase/auth';
import { useSendMessage } from '../mutations';

jest.mock('@/shared/lib/supabase/client', () => ({ getSupabaseClient: jest.fn() }));

function query(data: unknown, error: unknown = null) {
  const result = Object.assign(Promise.resolve({ data, error }), {
    select: jest.fn(), eq: jest.fn(), insert: jest.fn(), update: jest.fn(),
    single: jest.fn(), maybeSingle: jest.fn(),
  });
  for (const method of [result.select, result.eq, result.insert, result.update, result.single, result.maybeSingle]) method.mockReturnValue(result);
  return result;
}

it.each([
  ['default', undefined, false],
  ['link copy enabled', 'https://example.test/signup', false],
  ['link copy fails', 'https://example.test/signup', true],
] as const)('queues and dispatches the original despite assignment cleanup failure (%s)', async (_label, linkCopyBody, copyFails) => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  useAuthStore.setState({ user: { id: 'user' } as User });
  const invoke = jest.fn().mockResolvedValue({ data: {}, error: null });
  const original = query({ id: 'message' });
  const copy = copyFails ? query(null, { message: 'Copy insert failed' }) : query({ id: 'copy' });
  const attachments = query(null);
  const copyError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  let messageInserts = 0;
  jest.mocked(getSupabaseClient).mockReturnValue({
    from: jest.fn((table: string) => {
      if (table === 'staff') return query({ id: 'staff' });
      if (table === 'owned_numbers') return query({ id: 'sender', provider: 'IMESSAGE', sender_type: 'PHONE', phone_e164: '+61400000000' });
      if (table === 'messages') return messageInserts++ === 0 ? original : copy;
      if (table === 'message_attachments') return attachments;
      if (table === 'conversations') return query(null, { message: 'Assignment temporarily unavailable' });
      return query(null);
    }),
    functions: { invoke },
  } as unknown as ReturnType<typeof getSupabaseClient>);
  const { result } = renderHook(() => useSendMessage(), { wrapper: Wrapper });
  try {
    const body = 'Hello! Sign up at https://example.test/signup';
    await act(async () => {
      await expect(result.current.mutateAsync({
        conversationId: 'conversation',
        groupChatId: 'group',
        body,
        linkCopyBody,
        selectedSenderId: 'sender',
        attachments: [{ storageUrl: 'storage/file', filename: 'file', mimeType: 'text/plain', sizeBytes: 1 }],
        onboarding: { journeyId: 'journey', purpose: 'registration_link' },
      })).resolves.toEqual({
        messageId: 'message',
        conversationId: 'conversation',
        ...(copyFails ? { linkCopyFailed: true } : {}),
      });
    });
    expect(original.insert).toHaveBeenCalledWith(expect.objectContaining({
      body, onboarding_journey_id: 'journey', conversation_id: 'conversation', to_number_e164: 'group',
    }));
    expect(attachments.insert).toHaveBeenCalledTimes(1);
    expect(attachments.insert).toHaveBeenCalledWith([expect.objectContaining({ message_id: 'message' })]);
    expect(invoke).toHaveBeenNthCalledWith(1, 'send-message', { body: { messageId: 'message' } });
    if (linkCopyBody) {
      expect(copy.insert).toHaveBeenCalledWith(expect.objectContaining({
        body: linkCopyBody, conversation_id: 'conversation', to_number_e164: 'group',
      }));
      expect(copy.insert.mock.calls[0][0]).not.toHaveProperty('onboarding_journey_id');
    } else {
      expect(copy.insert).not.toHaveBeenCalled();
    }
    if (linkCopyBody && !copyFails) {
      expect(invoke).toHaveBeenNthCalledWith(2, 'send-message', { body: { messageId: 'copy' } });
    } else {
      expect(invoke).toHaveBeenCalledTimes(1);
    }
  } finally {
    warning.mockRestore();
    copyError.mockRestore();
    client.clear();
  }
});
