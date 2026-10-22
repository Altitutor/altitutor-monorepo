import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StudentInvoicesTable } from '../StudentInvoicesTable';

const mockToast = jest.fn();
const originalFetch = global.fetch;
let mockInvoice = {
  id: 'invoice',
  status: 'open',
  collection_method: 'charge_automatically',
  stripe_invoice_id: 'in_test',
  amount_due_cents: 5000,
  total_cents: 5000,
};

jest.mock('@altitutor/ui', () => ({
  ...jest.requireActual('@altitutor/ui'),
  DataTableToolbar: () => null,
  useToast: () => ({ toast: mockToast }),
}));
jest.mock('@/features/billing', () => ({
  useInvoicesList: () => ({ data: { invoices: [mockInvoice], total: 1 } }),
  useInvoiceItems: () => ({ data: {} }),
  formatInvoiceTagText: () => 'Invoice',
  ViewInvoiceModal: () => null,
  toInvoiceStatusPayload: () => null,
  getInvoiceStatusBadge: () => null,
}));
jest.mock('@/features/billing/hooks/useCreditNotesByInvoice', () => ({
  useCreditNotesByInvoice: () => ({ data: {} }),
}));
jest.mock('@/shared/hooks/usePaneNavigation', () => ({
  usePaneNavigation: () => ({ router: { push: jest.fn() } }),
}));
jest.mock('@/features/quick-filters/hooks/useQuickFilters', () => ({
  useQuickFilters: () => ({ data: [] }),
}));
jest.mock('@/shared/hooks', () => ({
  useCurrentStaff: () => ({ data: null }),
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock('@/shared/hooks/useDataTable', () => ({
  useDataTable: () => ({
    state: { filters: {}, page: 1, pageSize: 20, visibleColumns: ['actions'] },
  }),
}));
jest.mock('@/shared/components/TablePagination', () => ({
  TablePagination: () => null,
}));
jest.mock('@/shared/components/ActionsMenu', () => ({
  ActionsMenu: ({
    onSendInvoice,
    onChargeCard,
    isLoadingAction,
  }: {
    onSendInvoice?: () => void;
    onChargeCard?: () => void;
    isLoadingAction?: boolean;
  }) => (
    <>
      {onSendInvoice && (
        <button disabled={isLoadingAction} onClick={onSendInvoice}>
          Send Invoice
        </button>
      )}
      {onChargeCard && (
        <button disabled={isLoadingAction} onClick={onChargeCard}>
          Charge Card
        </button>
      )}
    </>
  ),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockInvoice = { ...mockInvoice, status: 'open' };
});

afterEach(() => {
  global.fetch = originalFetch;
});

it.each(['charge_automatically', 'send_invoice'])(
  'offers and runs both actions for an open %s invoice',
  async (collectionMethod) => {
    mockInvoice.collection_method = collectionMethod;
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sent: ['student@example.test'] }),
    });
    global.fetch = mockFetch;
    render(<StudentInvoicesTable studentId="student" />);
    fireEvent.click(screen.getByRole('button', { name: 'Send Invoice' }));
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Sent to: student@example.test',
        }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Charge Card' })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Charge Card' }));
    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/invoices/invoice/charge-card',
        { method: 'POST' },
      ),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/invoices/invoice/send-invoice',
      { method: 'POST' },
    );
  },
);

it('keeps payment actions hidden for a paid invoice', () => {
  mockInvoice.status = 'paid';
  render(<StudentInvoicesTable studentId="student" />);
  expect(
    screen.queryByRole('button', { name: 'Send Invoice' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Charge Card' }),
  ).not.toBeInTheDocument();
});
