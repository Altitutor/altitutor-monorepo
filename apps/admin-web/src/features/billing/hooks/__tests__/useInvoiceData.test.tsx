/**
 * Tests for useInvoiceData hook
 * Tests React Query integration for fetching invoice and invoice items
 */

import { waitFor } from '@testing-library/react';
import { useInvoiceData } from '../useInvoiceData';
import { billingApi } from '../../api/billing';
import { renderHookWithQueryClient } from '@/shared/test-utils';

// Mock the billing API
jest.mock('../../api/billing');

const mockBillingApi = billingApi as jest.Mocked<typeof billingApi>;

describe('useInvoiceData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch invoice and invoice items when invoiceId is provided', async () => {
    const mockInvoice = {
      id: 'invoice-1',
      student_id: 'student-1',
      status: 'open',
      amount_due_cents: 10000,
      invoice_date: '2024-01-15',
      student: {
        id: 'student-1',
        first_name: 'John',
        last_name: 'Doe',
      },
    };

    const mockInvoiceItems = [
      {
        id: 'item-1',
        invoice_id: 'invoice-1',
        amount_cents: 10000,
        description: 'Test item',
      },
    ];

    mockBillingApi.getInvoiceById.mockResolvedValue(mockInvoice as any);
    mockBillingApi.getInvoiceItemsByInvoice.mockResolvedValue(mockInvoiceItems as any);

    const { result } = renderHookWithQueryClient(() =>
      useInvoiceData({ invoiceId: 'invoice-1' })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.invoice).toEqual(mockInvoice);
    expect(result.current.invoiceItems).toEqual(mockInvoiceItems);
    expect(mockBillingApi.getInvoiceById).toHaveBeenCalledWith('invoice-1');
    expect(mockBillingApi.getInvoiceItemsByInvoice).toHaveBeenCalledWith('invoice-1');
  });

  it('should not fetch when invoiceId is null', () => {
    const { result } = renderHookWithQueryClient(() =>
      useInvoiceData({ invoiceId: null })
    );

    expect(result.current.invoice).toBeNull();
    expect(result.current.invoiceItems).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(mockBillingApi.getInvoiceById).not.toHaveBeenCalled();
    expect(mockBillingApi.getInvoiceItemsByInvoice).not.toHaveBeenCalled();
  });

  it('should not fetch when enabled is false', () => {
    const { result } = renderHookWithQueryClient(() =>
      useInvoiceData({ invoiceId: 'invoice-1', enabled: false })
    );

    expect(result.current.invoice).toBeNull();
    expect(result.current.invoiceItems).toEqual([]);
    expect(mockBillingApi.getInvoiceById).not.toHaveBeenCalled();
    expect(mockBillingApi.getInvoiceItemsByInvoice).not.toHaveBeenCalled();
  });

  it('should return isLoading true while fetching', async () => {
    let resolveInvoice: (value: any) => void;
    let resolveItems: (value: any) => void;

    const invoicePromise = new Promise((resolve) => {
      resolveInvoice = resolve;
    });
    const itemsPromise = new Promise((resolve) => {
      resolveItems = resolve;
    });

    mockBillingApi.getInvoiceById.mockReturnValue(invoicePromise as any);
    mockBillingApi.getInvoiceItemsByInvoice.mockReturnValue(itemsPromise as any);

    const { result } = renderHookWithQueryClient(() =>
      useInvoiceData({ invoiceId: 'invoice-1' })
    );

    expect(result.current.isLoading).toBe(true);

    resolveInvoice!({ id: 'invoice-1' });
    resolveItems!([]);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should handle invoice without student data', async () => {
    const mockInvoice = {
      id: 'invoice-1',
      student_id: 'student-1',
      status: 'open',
      amount_due_cents: 10000,
      invoice_date: '2024-01-15',
      student: null,
    };

    mockBillingApi.getInvoiceById.mockResolvedValue(mockInvoice as any);
    mockBillingApi.getInvoiceItemsByInvoice.mockResolvedValue([]);

    const { result } = renderHookWithQueryClient(() =>
      useInvoiceData({ invoiceId: 'invoice-1' })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.invoice).toEqual(mockInvoice);
    expect(result.current.invoice?.student).toBeNull();
  });

  it('should handle empty invoice items', async () => {
    const mockInvoice = {
      id: 'invoice-1',
      student_id: 'student-1',
      status: 'open',
      amount_due_cents: 10000,
      invoice_date: '2024-01-15',
    };

    mockBillingApi.getInvoiceById.mockResolvedValue(mockInvoice as any);
    mockBillingApi.getInvoiceItemsByInvoice.mockResolvedValue([]);

    const { result } = renderHookWithQueryClient(() =>
      useInvoiceData({ invoiceId: 'invoice-1' })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.invoiceItems).toEqual([]);
  });
});
