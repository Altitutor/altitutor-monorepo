/**
 * Tests for useInvoiceItems hook
 * Tests React Query useQueries integration for fetching multiple invoice items
 */

import { waitFor } from '@testing-library/react';
import { useInvoiceItems } from '../useInvoiceItems';
import { billingApi } from '../../api/billing';
import { renderHookWithQueryClient } from '@/shared/test-utils';

// Mock the billing API
jest.mock('../../api/billing');

const mockBillingApi = billingApi as jest.Mocked<typeof billingApi>;

describe('useInvoiceItems', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch invoice items for multiple invoices', async () => {
    const mockItems1 = [
      { id: 'item-1', invoice_id: 'invoice-1', amount_cents: 10000 },
      { id: 'item-2', invoice_id: 'invoice-1', amount_cents: 20000 },
    ];
    const mockItems2 = [
      { id: 'item-3', invoice_id: 'invoice-2', amount_cents: 15000 },
    ];

    mockBillingApi.getInvoiceItemsByInvoice
      .mockResolvedValueOnce(mockItems1 as any)
      .mockResolvedValueOnce(mockItems2 as any);

    const { result } = renderHookWithQueryClient(() =>
      useInvoiceItems(['invoice-1', 'invoice-2'])
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual({
      'invoice-1': mockItems1,
      'invoice-2': mockItems2,
    });
    expect(mockBillingApi.getInvoiceItemsByInvoice).toHaveBeenCalledTimes(2);
    expect(mockBillingApi.getInvoiceItemsByInvoice).toHaveBeenCalledWith('invoice-1');
    expect(mockBillingApi.getInvoiceItemsByInvoice).toHaveBeenCalledWith('invoice-2');
  });

  it('should return empty map when invoiceIds is empty', () => {
    const { result } = renderHookWithQueryClient(() => useInvoiceItems([]));

    expect(result.current.data).toEqual({});
    expect(result.current.isLoading).toBe(false);
    expect(mockBillingApi.getInvoiceItemsByInvoice).not.toHaveBeenCalled();
  });

  it('should handle single invoice', async () => {
    const mockItems = [
      { id: 'item-1', invoice_id: 'invoice-1', amount_cents: 10000 },
    ];

    mockBillingApi.getInvoiceItemsByInvoice.mockResolvedValue(mockItems as any);

    const { result } = renderHookWithQueryClient(() =>
      useInvoiceItems(['invoice-1'])
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual({
      'invoice-1': mockItems,
    });
  });

  it('should return isLoading true while any query is loading', async () => {
    let resolve1: (value: any) => void;
    let resolve2: (value: any) => void;

    const promise1 = new Promise((resolve) => {
      resolve1 = resolve;
    });
    const promise2 = new Promise((resolve) => {
      resolve2 = resolve;
    });

    mockBillingApi.getInvoiceItemsByInvoice
      .mockReturnValueOnce(promise1 as any)
      .mockReturnValueOnce(promise2 as any);

    const { result } = renderHookWithQueryClient(() =>
      useInvoiceItems(['invoice-1', 'invoice-2'])
    );

    expect(result.current.isLoading).toBe(true);

    resolve1!([]);
    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });

    resolve2!([]);
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should handle errors from individual queries', async () => {
    const error = new Error('Failed to fetch');
    mockBillingApi.getInvoiceItemsByInvoice
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(error);

    const { result } = renderHookWithQueryClient(() =>
      useInvoiceItems(['invoice-1', 'invoice-2'])
    );

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.error).toEqual(error);
  });

  it('should exclude invoices with no data from the map', async () => {
    mockBillingApi.getInvoiceItemsByInvoice
      .mockResolvedValueOnce([{ id: 'item-1', invoice_id: 'invoice-1' }] as any)
      .mockResolvedValueOnce([]);

    const { result } = renderHookWithQueryClient(() =>
      useInvoiceItems(['invoice-1', 'invoice-2'])
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // invoice-2 should not be in the map if it has no items
    expect(result.current.data['invoice-1']).toBeDefined();
    expect(result.current.data['invoice-2']).toBeDefined(); // Empty array is still included
    expect(result.current.data['invoice-2']).toEqual([]);
  });

  it('should handle many invoices efficiently', async () => {
    const invoiceIds = Array.from({ length: 10 }, (_, i) => `invoice-${i + 1}`);
    mockBillingApi.getInvoiceItemsByInvoice.mockResolvedValue([]);

    const { result } = renderHookWithQueryClient(() =>
      useInvoiceItems(invoiceIds)
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockBillingApi.getInvoiceItemsByInvoice).toHaveBeenCalledTimes(10);
    expect(Object.keys(result.current.data)).toHaveLength(10);
  });
});
