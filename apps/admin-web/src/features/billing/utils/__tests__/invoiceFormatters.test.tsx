/**
 * Tests for invoice formatter utilities
 * Tests date formatting, status badges, amount formatting, and calculations
 */

import { render } from '@testing-library/react';
import {
  formatInvoiceDate,
  getInvoiceStatusBadge,
  formatInvoiceAmount,
  calculateLineItemsSubtotal,
} from '../invoiceFormatters';

describe('formatInvoiceDate', () => {
  it('should format valid date string', () => {
    const dateString = '2024-01-15T10:30:00Z';
    const result = formatInvoiceDate(dateString);
    expect(result).toMatch(/Monday, January 15, 2024/);
  });

  it('should return "-" for null', () => {
    expect(formatInvoiceDate(null)).toBe('-');
  });

  it('should return "-" for empty string', () => {
    expect(formatInvoiceDate('')).toBe('-');
  });

  it('should handle invalid date strings gracefully', () => {
    const invalidDate = 'not-a-date';
    const result = formatInvoiceDate(invalidDate);
    expect(result).toBe(invalidDate);
  });

  it('should format different dates correctly', () => {
    expect(formatInvoiceDate('2024-12-25T00:00:00Z')).toMatch(/December 25, 2024/);
    expect(formatInvoiceDate('2023-06-01T12:00:00Z')).toMatch(/June 1, 2023/);
  });
});

describe('getInvoiceStatusBadge', () => {
  it('should return correct badge for "paid" status', () => {
    const { getByText } = render(getInvoiceStatusBadge('paid'));
    expect(getByText('Paid')).toBeInTheDocument();
  });

  it('should return "Paid (Refunded)" for paid with isRefunded true', () => {
    const { getByText } = render(getInvoiceStatusBadge('paid', true));
    expect(getByText('Paid (Refunded)')).toBeInTheDocument();
  });

  it('should return "Paid (Refunded)" for paid_refunded status', () => {
    const { getByText } = render(getInvoiceStatusBadge('paid_refunded'));
    expect(getByText('Paid (Refunded)')).toBeInTheDocument();
  });

  it('should return correct badge for "draft" status', () => {
    const { getByText } = render(getInvoiceStatusBadge('draft'));
    expect(getByText('Draft')).toBeInTheDocument();
  });

  it('should return correct badge for "open" status', () => {
    const { getByText } = render(getInvoiceStatusBadge('open'));
    expect(getByText('Open')).toBeInTheDocument();
  });

  it('should return destructive badge for "void" status', () => {
    const { getByText } = render(getInvoiceStatusBadge('void'));
    expect(getByText('Void')).toBeInTheDocument();
  });

  it('should return destructive badge for "uncollectible" status', () => {
    const { getByText } = render(getInvoiceStatusBadge('uncollectible'));
    expect(getByText('Uncollectible')).toBeInTheDocument();
  });

  it('should return destructive badge for "disputed" status', () => {
    const { getByText } = render(getInvoiceStatusBadge('disputed'));
    expect(getByText('Disputed')).toBeInTheDocument();
  });

  it('should handle unknown status gracefully', () => {
    const { container } = render(getInvoiceStatusBadge('unknown'));
    // Badge should still render, just check it's a valid React element
    expect(container.firstChild).toBeTruthy();
  });
});

describe('formatInvoiceAmount', () => {
  it('should format amount in cents to currency string', () => {
    expect(formatInvoiceAmount(10000)).toBe('$100.00 AUD');
    expect(formatInvoiceAmount(12345)).toBe('$123.45 AUD');
    expect(formatInvoiceAmount(0)).toBe('$0.00 AUD');
  });

  it('should handle null amount', () => {
    expect(formatInvoiceAmount(null)).toBe('$0.00 AUD');
  });

  it('should handle undefined amount', () => {
    expect(formatInvoiceAmount(undefined)).toBe('$0.00 AUD');
  });

  it('should use custom currency', () => {
    expect(formatInvoiceAmount(10000, 'USD')).toBe('$100.00 USD');
    expect(formatInvoiceAmount(10000, 'EUR')).toBe('$100.00 EUR');
  });

  it('should handle decimal cents correctly', () => {
    expect(formatInvoiceAmount(1)).toBe('$0.01 AUD');
    expect(formatInvoiceAmount(99)).toBe('$0.99 AUD');
    expect(formatInvoiceAmount(100000)).toBe('$1000.00 AUD');
  });
});

describe('calculateLineItemsSubtotal', () => {
  it('should calculate subtotal from invoice items', () => {
    const items = [
      { amount_cents: 10000 },
      { amount_cents: 20000 },
      { amount_cents: 5000 },
    ];
    expect(calculateLineItemsSubtotal(items)).toBe(35000);
  });

  it('should handle null amounts', () => {
    const items = [
      { amount_cents: 10000 },
      { amount_cents: null },
      { amount_cents: 20000 },
    ];
    expect(calculateLineItemsSubtotal(items)).toBe(30000);
  });

  it('should handle undefined amounts', () => {
    const items = [
      { amount_cents: 10000 },
      { amount_cents: undefined },
      { amount_cents: 20000 },
    ];
    expect(calculateLineItemsSubtotal(items)).toBe(30000);
  });

  it('should return 0 for empty array', () => {
    expect(calculateLineItemsSubtotal([])).toBe(0);
  });

  it('should handle items without amount_cents property', () => {
    const items = [
      { amount_cents: 10000 },
      {},
      { amount_cents: 20000 },
    ];
    expect(calculateLineItemsSubtotal(items)).toBe(30000);
  });

  it('should handle negative amounts', () => {
    const items = [
      { amount_cents: 10000 },
      { amount_cents: -5000 },
      { amount_cents: 20000 },
    ];
    expect(calculateLineItemsSubtotal(items)).toBe(25000);
  });
});
