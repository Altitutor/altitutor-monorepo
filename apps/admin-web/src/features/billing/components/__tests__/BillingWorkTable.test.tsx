import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useQuery } from '@tanstack/react-query';
import { useSessionBillingAdjustmentIssues } from '@/features/reconciliation/api/queries';
import { BillingWorkTable } from '../BillingWorkTable';

jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn(), queryOptions: (options: unknown) => options }));
jest.mock('@/features/reconciliation/api/queries', () => ({ useSessionBillingAdjustmentIssues: jest.fn() }));
jest.mock('@/shared/hooks/useAdminUrlSync', () => ({ useAdminUrlSync: jest.fn() }));
jest.mock('@/shared/hooks', () => ({ useCurrentStaff: () => ({ data: { id: 'staff' } }) }));
jest.mock('@/features/quick-filters/hooks/useQuickFilters', () => ({ useQuickFilters: () => ({ data: [] }) }));
jest.mock('@/features/sessions/hooks/useInvoiceSessionMutation', () => ({ useInvoiceSessionMutation: () => ({ mutate: mockInvoice, isPending: false }) }));
jest.mock('@/shared/contexts/EntityNavigation', () => ({ useEntityNavigation: () => ({ openStudent: jest.fn(), openSession: jest.fn(), openInvoice: jest.fn() }) }));
jest.mock('./../DeleteVoidInvoiceButton', () => ({ DeleteVoidInvoiceButton: () => null }));
jest.mock('@/shared/hooks/useDataTable', () => ({ useDataTable: () => ({
  state: { search: '', filters: mockFilters, sortBy: 'date', sortDirection: 'asc', visibleColumns: ['student', 'session', 'date', 'amount', 'issue'], page: 1, pageSize: 50 },
  setSearch: jest.fn(), setFilters: jest.fn(), setSort: jest.fn(), setVisibleColumns: jest.fn(), applyQuickFilter: jest.fn(), resetFilters: jest.fn(), setPage: jest.fn(), setPageSize: jest.fn(),
}) }));
jest.mock('@altitutor/ui', () => ({ ...jest.requireActual('@altitutor/ui'), DataTableToolbar: () => null, TablePagination: () => null }));

const mockInvoice = jest.fn();
let mockFilters: Record<string, string[]> = {};
const base = { session_id: 'session', session_short_name: 'Maths', session_name: 'Maths', session_start_at: '2026-11-10T05:30:00Z', reason: 'uninvoiced' };
const charges = [
  { ...base, sessions_students_id: 'alice-charge', student_id: 'alice', student_first_name: 'Alice' },
  { ...base, sessions_students_id: 'bob-charge', student_id: 'bob', student_first_name: 'Bob' },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockFilters = {};
  jest.mocked(useQuery).mockImplementation((options) => {
    const key = (options as { queryKey: unknown[] }).queryKey;
    const data = key.includes('billing-charges') ? charges
      : key[0] === 'billing-work-labels' ? { students: { alice: 'Alice' }, sessions: { session: 'Maths' } } : {};
    return { data, isLoading: false, isFetching: false, error: null, refetch: jest.fn() } as unknown as ReturnType<typeof useQuery>;
  });
  jest.mocked(useSessionBillingAdjustmentIssues).mockReturnValue({ data: [], error: null, isLoading: false, isFetching: false } as unknown as ReturnType<typeof useSessionBillingAdjustmentIssues>);
});

it('keeps two students in one session as separate charge rows and invoices only the selected assignment', async () => {
  const user = userEvent.setup();
  render(<BillingWorkTable mode="charges" />);
  expect(screen.getAllByRole('button', { name: 'Maths' })).toHaveLength(2);
  const bob = screen.getByRole('button', { name: 'Bob' }).closest('tr')!;
  await user.click(within(bob).getByRole('button', { name: 'Billing actions' }));
  await user.click(screen.getByRole('menuitem', { name: 'Invoice session' }));
  expect(mockInvoice).toHaveBeenCalledWith('bob-charge');
});

it('applies student and date scope from legacy financial links', () => {
  mockFilters = { student: ['bob'], from: ['2026-11-10'], to: ['2026-11-10'] };
  render(<BillingWorkTable mode="charges" />);
  expect(screen.queryByRole('button', { name: 'Alice' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Bob' })).toBeInTheDocument();
});

it('keeps multiple adjustments for the same assignment as separate work rows', () => {
  const baseAdjustment = { sessions_students_id: 'alice-charge', student_id: 'alice', session_id: 'session', session_start_at: '2026-11-10T05:30:00Z',
    status: 'failed', issue: 'failed_adjustment', amount_cents: 1000, currency: 'aud', attempt_count: 3, max_attempts: 3 };
  jest.mocked(useSessionBillingAdjustmentIssues).mockReturnValue({ data: [
    { ...baseAdjustment, adjustment_id: 'credit', kind: 'credit_note' },
    { ...baseAdjustment, adjustment_id: 'charge', kind: 'restoration_charge' },
  ], error: null, isLoading: false, isFetching: false } as unknown as ReturnType<typeof useSessionBillingAdjustmentIssues>);
  render(<BillingWorkTable mode="adjustments" />);
  expect(screen.getAllByRole('button', { name: 'Alice' })).toHaveLength(2);
  expect(screen.getByText('Credit note · Needs review')).toBeInTheDocument();
  expect(screen.getByText('Restored session charge · Needs review')).toBeInTheDocument();
});
