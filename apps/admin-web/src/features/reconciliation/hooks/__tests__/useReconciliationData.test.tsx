import { useReconciliationData } from '../useReconciliationData';
import * as queries from '../../api/queries';
import { renderHookWithQueryClient } from '@/shared/test-utils';
import type { UseQueryResult } from '@tanstack/react-query';
import type {
  UninvoicedSession,
  UnpaidInvoice,
  UnloggedSession,
  UnassignedClass,
  UnassignedTask,
  FailedDeliveryMessage,
  StudentWithoutClasses,
  StudentWithoutPaymentMethod,
  TrialStudentNotSignedUp,
} from '../../types';

// Mock the query hooks
jest.mock('../../api/queries');

const mockQueries = queries as jest.Mocked<typeof queries>;

// Helper to create a mock UseQueryResult
const createMockQueryResult = <T,>(
  data: T,
  overrides?: Partial<Pick<UseQueryResult<T, Error>, 'isLoading' | 'isError'>>
): UseQueryResult<T, Error> => ({
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
} as unknown as UseQueryResult<T, Error>);

describe('useReconciliationData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock returns
    mockQueries.useUninvoicedSessions.mockReturnValue(
      createMockQueryResult<UninvoicedSession[]>([])
    );
    
    mockQueries.useUnpaidInvoices.mockReturnValue(
      createMockQueryResult<UnpaidInvoice[]>([])
    );
    
    mockQueries.useUnloggedSessions.mockReturnValue(
      createMockQueryResult<UnloggedSession[]>([])
    );
    
    mockQueries.useUnassignedClasses.mockReturnValue(
      createMockQueryResult<UnassignedClass[]>([])
    );

    mockQueries.useUnassignedTasks.mockReturnValue(
      createMockQueryResult<UnassignedTask[]>([])
    );

    mockQueries.useFailedDeliveryMessages.mockReturnValue(
      createMockQueryResult<FailedDeliveryMessage[]>([])
    );
    
    mockQueries.useStudentsWithoutClasses.mockReturnValue(
      createMockQueryResult<StudentWithoutClasses[]>([])
    );
    
    mockQueries.useStudentsWithoutPaymentMethod.mockReturnValue(
      createMockQueryResult<StudentWithoutPaymentMethod[]>([])
    );
    
    mockQueries.useTrialStudentsNotSignedUp.mockReturnValue(
      createMockQueryResult<TrialStudentNotSignedUp[]>([])
    );
  });

  it('should aggregate all queries', () => {
    const { result } = renderHookWithQueryClient(() => useReconciliationData());

    expect(result.current).toHaveProperty('uninvoicedSessions');
    expect(result.current).toHaveProperty('unpaidInvoices');
    expect(result.current).toHaveProperty('unloggedSessions');
    expect(result.current).toHaveProperty('unassignedClasses');
    expect(result.current).toHaveProperty('unassignedTasks');
    expect(result.current).toHaveProperty('failedDeliveryMessages');
    expect(result.current).toHaveProperty('studentsWithoutClasses');
    expect(result.current).toHaveProperty('studentsWithoutPaymentMethod');
    expect(result.current).toHaveProperty('trialStudentsNotSignedUp');
  });

  it('should return isLoading true when any query is loading', () => {
    mockQueries.useUninvoicedSessions.mockReturnValue(
      createMockQueryResult<UninvoicedSession[]>([], { isLoading: true })
    );

    const { result } = renderHookWithQueryClient(() => useReconciliationData());

    expect(result.current.isLoading).toBe(true);
  });

  it('should return isLoading false when all queries are loaded', () => {
    const { result } = renderHookWithQueryClient(() => useReconciliationData());

    expect(result.current.isLoading).toBe(false);
  });

  it('should return hasError true when any query has error', () => {
    mockQueries.useUnpaidInvoices.mockReturnValue(
      createMockQueryResult<UnpaidInvoice[]>([], { isError: true })
    );

    const { result } = renderHookWithQueryClient(() => useReconciliationData());

    expect(result.current.hasError).toBe(true);
  });

  it('should return hasError false when no queries have errors', () => {
    const { result } = renderHookWithQueryClient(() => useReconciliationData());

    expect(result.current.hasError).toBe(false);
  });
});
