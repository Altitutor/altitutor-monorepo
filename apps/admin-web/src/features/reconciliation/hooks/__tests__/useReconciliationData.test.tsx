import { useReconciliationData } from '../useReconciliationData';
import * as queries from '../../api/queries';
import { renderHookWithQueryClient } from '@/shared/test-utils';

// Mock the query hooks
jest.mock('../../api/queries');

const mockQueries = queries as jest.Mocked<typeof queries>;

describe('useReconciliationData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock returns
    mockQueries.useUninvoicedSessions.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any);
    
    mockQueries.useUnpaidInvoices.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any);
    
    mockQueries.useUnloggedSessions.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any);
    
    mockQueries.useUnassignedClasses.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any);
    
    mockQueries.useUnrepliedMessages.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any);
    
    mockQueries.useFailedDeliveryMessages.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any);
    
    mockQueries.useStudentsWithoutClasses.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any);
    
    mockQueries.useStudentsWithoutPaymentMethod.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any);
  });

  it('should aggregate all queries', () => {
    const { result } = renderHookWithQueryClient(() => useReconciliationData());

    expect(result.current).toHaveProperty('uninvoicedSessions');
    expect(result.current).toHaveProperty('unpaidInvoices');
    expect(result.current).toHaveProperty('unloggedSessions');
    expect(result.current).toHaveProperty('unassignedClasses');
    expect(result.current).toHaveProperty('unrepliedMessages');
    expect(result.current).toHaveProperty('failedDeliveryMessages');
    expect(result.current).toHaveProperty('studentsWithoutClasses');
    expect(result.current).toHaveProperty('studentsWithoutPaymentMethod');
  });

  it('should return isLoading true when any query is loading', () => {
    mockQueries.useUninvoicedSessions.mockReturnValue({
      data: [],
      isLoading: true,
      isError: false,
    } as any);

    const { result } = renderHookWithQueryClient(() => useReconciliationData());

    expect(result.current.isLoading).toBe(true);
  });

  it('should return isLoading false when all queries are loaded', () => {
    const { result } = renderHookWithQueryClient(() => useReconciliationData());

    expect(result.current.isLoading).toBe(false);
  });

  it('should return hasError true when any query has error', () => {
    mockQueries.useUnpaidInvoices.mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
    } as any);

    const { result } = renderHookWithQueryClient(() => useReconciliationData());

    expect(result.current.hasError).toBe(true);
  });

  it('should return hasError false when no queries have errors', () => {
    const { result } = renderHookWithQueryClient(() => useReconciliationData());

    expect(result.current.hasError).toBe(false);
  });
});
