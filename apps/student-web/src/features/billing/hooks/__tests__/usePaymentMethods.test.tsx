import React, { type ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { paymentMethodsApi } from '../../api/payment-methods';
import { usePaymentMethods } from '../usePaymentMethods';
import type { BillingData } from '../../api/payment-methods';

jest.mock('@/shared/lib/supabase/client', () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock('@/shared/lib/supabase/auth', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1' },
    loading: false,
  }),
}));

jest.mock('@altitutor/ui', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('../../api/payment-methods', () => ({
  paymentMethodsApi: {
    getPaymentMethods: jest.fn(),
  },
}));

const mockGetSupabaseClient = getSupabaseClient as jest.MockedFunction<
  typeof getSupabaseClient
>;
const mockGetPaymentMethods = paymentMethodsApi.getPaymentMethods as jest.MockedFunction<
  typeof paymentMethodsApi.getPaymentMethods
>;

const studentId = '1dbb99eb-b551-44f8-a383-7b0b8ce8a652';

const billingData: BillingData = {
  student_id: studentId,
  stripe_customer_id: 'cus_test',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  payment_methods: [],
  default_payment_method: null,
};

type PostgresChangesBinding = {
  type: 'postgres_changes';
  subscribed: boolean;
  on: (type: string) => PostgresChangesBinding;
  subscribe: () => PostgresChangesBinding;
};

/**
 * Mirrors supabase-js RealtimeClient: named channels are reused, and
 * postgres_changes bindings cannot be added after subscribe().
 */
function createRealtimeClientMock() {
  const channels = new Map<string, PostgresChangesBinding>();

  const createChannel = (name: string): PostgresChangesBinding => {
    const channel: PostgresChangesBinding = {
      type: 'postgres_changes',
      subscribed: false,
      on(type: string) {
        if (type === 'postgres_changes' && channel.subscribed) {
          throw new Error(
            `cannot add \`${type}\` callbacks for realtime:${name} after \`subscribe()\`.`,
          );
        }
        return channel;
      },
      subscribe() {
        channel.subscribed = true;
        return channel;
      },
    };
    return channel;
  };

  return {
    channel(name: string) {
      const existing = channels.get(name);
      if (existing) return existing;
      const created = createChannel(name);
      channels.set(name, created);
      return created;
    },
    removeChannel(channel: PostgresChangesBinding) {
      for (const [name, existing] of channels) {
        if (existing === channel) {
          channels.delete(name);
        }
      }
    },
  };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </React.StrictMode>
  );
  Wrapper.displayName = 'PaymentMethodsTestWrapper';
  return Wrapper;
}

describe('usePaymentMethods realtime subscription', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPaymentMethods.mockResolvedValue(billingData);
    mockGetSupabaseClient.mockReturnValue(
      createRealtimeClientMock() as unknown as ReturnType<typeof getSupabaseClient>,
    );
  });

  it('does not add postgres_changes callbacks after subscribe when two billing subscribers mount', async () => {
    const { result } = renderHook(
      () => {
        const preWarm = usePaymentMethods();
        const paymentMethodCard = usePaymentMethods();
        return { preWarm, paymentMethodCard };
      },
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.preWarm.isSuccess).toBe(true);
      expect(result.current.paymentMethodCard.isSuccess).toBe(true);
    });

    expect(result.current.preWarm.data?.student_id).toBe(studentId);
  });
});
