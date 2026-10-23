import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@altitutor/ui';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvoiceDetailPage from '@/app/(admin)/invoices/[id]/page';
import { StudentInvoicesTable } from '@/features/students/components/StudentInvoicesTable';

const originalFetch = global.fetch;
let mockInvoice = {
  id: 'invoice',
  student_id: 'student',
  status: 'open',
  collection_method: 'charge_automatically',
  stripe_invoice_id: 'in_test',
  stripe_invoice_number: 'TEST-001',
  amount_due_cents: 5000,
  total_cents: 5000,
  amount_paid_cents: 0,
  currency: 'aud',
  invoice_date: '2026-10-22',
};

// Only external SDK/router boundaries are substituted. The page, table, menu,
// data hooks, query invalidation and toast delivery are the real implementations.
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/invoices/invoice',
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('@supabase/ssr', () => ({
  createBrowserClient: () => ({
    from: (table: string) => {
      const result = () => ({
        data: table === 'invoices' ? [mockInvoice] : [],
        error: null,
        count: 1,
      });
      const builder: Record<string, unknown> = {};
      for (const method of [
        'select',
        'eq',
        'is',
        'in',
        'order',
        'range',
        'limit',
      ]) {
        builder[method] = () => builder;
      }
      builder.maybeSingle = async () => ({
        data: table === 'invoices' ? mockInvoice : null,
        error: null,
      });
      builder.then = (resolve: (value: ReturnType<typeof result>) => unknown) =>
        Promise.resolve(result()).then(resolve);
      return builder;
    },
    rpc: async (name: string) => ({
      data:
        name === 'search_invoices_admin'
          ? { invoices: [mockInvoice], total: 1 }
          : [],
      error: null,
    }),
  }),
}));

const clients: QueryClient[] = [];
beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:1';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-fixture';
  mockInvoice = { ...mockInvoice, status: 'open' };
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      sent: ['student@example.test'],
      credit_notes: [],
      attempt_count: 0,
      next_payment_attempt: null,
      auto_retry_active: false,
    }),
  });
});
afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
  global.fetch = originalFetch;
});

function renderSurface(surface: 'detail' | 'student') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        {surface === 'detail' ? (
          <InvoiceDetailPage params={{ id: 'invoice' }} />
        ) : (
          <StudentInvoicesTable studentId="student" />
        )}
      </ToastProvider>
    </QueryClientProvider>,
  );
}

async function openActions(surface: 'detail' | 'student') {
  const user = userEvent.setup();
  if (surface === 'student') {
    const row = await screen.findByRole('row', { name: /TEST-001/ });
    await user.click(within(row).getByRole('button'));
  } else {
    await waitFor(() =>
      expect(screen.getByText('Invoice Information')).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { expanded: false }));
  }
  return user;
}

describe.each(['detail', 'student'] as const)(
  '%s invoice actions',
  (surface) => {
    it.each(['charge_automatically', 'send_invoice'])(
      'offers and runs both actions on a %s invoice',
      async (collectionMethod) => {
        mockInvoice.collection_method = collectionMethod;
        renderSurface(surface);
        const user = await openActions(surface);
        expect(
          screen.getByRole('menuitem', { name: 'Charge Card' }),
        ).toBeInTheDocument();
        await user.click(
          screen.getByRole('menuitem', { name: 'Send Invoice' }),
        );
        await screen.findByText('Sent to: student@example.test');
        await waitFor(() =>
          expect(global.fetch).toHaveBeenCalledWith(
            '/api/invoices/invoice/send-invoice',
            { method: 'POST' },
          ),
        );
        await openActions(surface);
        await user.click(screen.getByRole('menuitem', { name: 'Charge Card' }));
        await screen.findByText('Payment attempt initiated successfully');
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/invoices/invoice/charge-card',
          { method: 'POST' },
        );
      },
    );

    it('hides both actions on a paid invoice', async () => {
      mockInvoice.status = 'paid';
      renderSurface(surface);
      await openActions(surface);
      expect(
        screen.queryByRole('menuitem', { name: 'Send Invoice' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('menuitem', { name: 'Charge Card' }),
      ).not.toBeInTheDocument();
    });
  },
);
