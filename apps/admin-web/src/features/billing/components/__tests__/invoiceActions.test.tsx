import { webcrypto } from 'node:crypto';
import { TextEncoder } from 'node:util';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@altitutor/ui';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvoiceDetailPage from '@/app/(admin)/invoices/[id]/page';
import { StudentInvoicesTable } from '@/features/students/components/StudentInvoicesTable';
import { useStudentInvoiceOwing } from '@/features/billing/hooks/useInvoicesQuery';

const originalFetch = global.fetch;
const originalCrypto = global.crypto;
let mockOwingError = false;
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
        error: null as Error | null,
        count: 1,
      });
      const builder: Record<string, unknown> = {};
      for (const method of [
        'select',
        'eq',
        'is',
        'not',
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
        Promise.resolve(mockOwingError && table === 'invoices' ? { ...result(), error: new Error('Unavailable') } : result()).then(resolve);
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
  Object.defineProperty(global, 'crypto', { configurable: true, value: webcrypto });
  Object.defineProperty(global, 'TextEncoder', { configurable: true, value: TextEncoder });
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:1';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-fixture';
  mockInvoice = { ...mockInvoice, status: 'open', amount_paid_cents: 0 };
  mockOwingError = false;
  global.fetch = jest.fn().mockImplementation(async (url: string) => ({
    ok: true,
    clone: () => ({ json: async () => ({ success: true }) }),
    json: async () => url.endsWith('/customer-balance') ? {
      linked: false,
      stripe_customer_id: null,
      balance_cents: 0,
      currency: 'aud',
    } : ({
      sent: ['student@example.test'],
      credit_notes: [],
      attempt_count: 0,
      next_payment_attempt: null,
      auto_retry_active: false,
    }),
  }));
});
afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
  global.fetch = originalFetch;
  Object.defineProperty(global, 'crypto', { configurable: true, value: originalCrypto });
  sessionStorage.clear();
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
          <><InvoiceDetailPage params={{ id: 'invoice' }} /><OwingProbe /></>
        ) : (
          <StudentInvoicesTable studentId="student" />
        )}
      </ToastProvider>
    </QueryClientProvider>,
  );
}

function OwingProbe() {
  const owing = useStudentInvoiceOwing('student');
  return <output aria-label="Owing probe">{owing.data?.[0]?.amountCents}</output>;
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
            expect.objectContaining({ method: 'POST', headers: expect.any(Headers) }),
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

    it('refreshes the independent total after a successful payment attempt', async () => {
      renderSurface(surface);
      if (surface === 'student') await screen.findByText(/AUD\s*50\.00/);
      else await waitFor(() => expect(screen.getByLabelText('Owing probe')).toHaveTextContent('5000'));
      const user = await openActions(surface);
      (global.fetch as jest.Mock).mockImplementation(async () => {
        mockInvoice = { ...mockInvoice, amount_paid_cents: 2500 };
        return {ok: true, json: async () => ({attempt_count:0,next_payment_attempt:null,auto_retry_active:false})};
      });
      await user.click(screen.getByRole('menuitem', { name: 'Charge Card' }));
      await screen.findByText('Payment attempt initiated successfully');
      if (surface === 'student') await screen.findByText(/AUD\s*25\.00/);
      else await waitFor(() => expect(screen.getByLabelText('Owing probe')).toHaveTextContent('2500'));
    });
  },
);

it('keeps the total independent of invoice search', async () => {
  renderSurface('student');
  await screen.findByText(/AUD\s*50\.00/);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Search' }));
  const search = screen.getAllByRole('textbox').find(input => input.getAttribute('placeholder')?.toLowerCase().includes('search'));
  expect(search).toBeDefined();
  await user.type(search!, 'different invoice');
  expect(screen.getByText(/AUD\s*50\.00/)).toBeInTheDocument();
});

it('shows an unavailable total rather than zero when its query fails', async () => {
  mockOwingError = true;
  renderSurface('student');
  await screen.findByText('Unable to load total');
  expect(screen.queryByText('No open invoices')).not.toBeInTheDocument();
});
