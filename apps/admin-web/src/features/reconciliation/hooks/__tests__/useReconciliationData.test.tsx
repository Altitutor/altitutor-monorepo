import { useReconciliationFinancialData } from '../useReconciliationData';
import * as queries from '../../api/queries';
import { renderHookWithQueryClient } from '@/shared/test-utils';
import type { UseQueryResult } from '@tanstack/react-query';
import type { UninvoicedSession, VoidInvoiceSession, UnpaidInvoice, StudentWithoutPaymentMethod } from '../../types';

jest.mock('../../api/queries');

const mockQueries = queries as jest.Mocked<typeof queries>;

const createMockQueryResult = <T,>(
  data: T,
  overrides?: Partial<Pick<UseQueryResult<T, Error>, 'isLoading' | 'isError'>>
): UseQueryResult<T, Error> =>
  ({
    data,
    isLoading: overrides?.isLoading ?? false,
    isError: overrides?.isError ?? false,
    error: null,
    isPending: false,
    isSuccess: true,
    isFetching: false,
    isRefetching: false,
    isLoadingError: false,
    isRefetchError: false,
    isPaused: false,
    status: 'success' as const,
    dataUpdatedAt: Date.now(),
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    errorUpdateCount: 0,
    isFetched: true,
    isFetchedAfterMount: true,
    isInitialLoading: false,
    isPlaceholderData: false,
    isStale: false,
    refetch: jest.fn(),
    fetchStatus: 'idle' as const,
    isEnabled: true,
    promise: Promise.resolve(data),
  }) as unknown as UseQueryResult<T, Error>;

describe('useReconciliationFinancialData', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockQueries.useUninvoicedSessions.mockReturnValue(createMockQueryResult<UninvoicedSession[]>([]));
    mockQueries.useVoidInvoiceSessions.mockReturnValue(createMockQueryResult<VoidInvoiceSession[]>([]));
    mockQueries.useUnpaidInvoices.mockReturnValue(createMockQueryResult<UnpaidInvoice[]>([]));
    mockQueries.useStudentsWithoutPaymentMethod.mockReturnValue(
      createMockQueryResult<StudentWithoutPaymentMethod[]>([])
    );
  });

  it('should expose financial query results', () => {
    const { result } = renderHookWithQueryClient(() => useReconciliationFinancialData());

    expect(result.current).toHaveProperty('uninvoicedSessions');
    expect(result.current).toHaveProperty('voidInvoiceSessions');
    expect(result.current).toHaveProperty('unpaidInvoices');
    expect(result.current).toHaveProperty('studentsWithoutPaymentMethod');
  });

  it('should return isLoading true when any financial query is loading', () => {
    mockQueries.useUninvoicedSessions.mockReturnValue(
      createMockQueryResult<UninvoicedSession[]>([], { isLoading: true })
    );

    const { result } = renderHookWithQueryClient(() => useReconciliationFinancialData());

    expect(result.current.isLoading).toBe(true);
  });

  it('should return isLoading false when all financial queries are loaded', () => {
    const { result } = renderHookWithQueryClient(() => useReconciliationFinancialData());

    expect(result.current.isLoading).toBe(false);
  });

  it('should return hasError true when any financial query has error', () => {
    mockQueries.useUnpaidInvoices.mockReturnValue(createMockQueryResult<UnpaidInvoice[]>([], { isError: true }));

    const { result } = renderHookWithQueryClient(() => useReconciliationFinancialData());

    expect(result.current.hasError).toBe(true);
  });

  it('should return hasError false when no financial queries have errors', () => {
    const { result } = renderHookWithQueryClient(() => useReconciliationFinancialData());

    expect(result.current.hasError).toBe(false);
  });
});
