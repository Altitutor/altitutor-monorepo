import { normalizeInvoiceNumberSearch } from '../useInvoicesQuery';

describe('normalizeInvoiceNumberSearch', () => {
  it('returns undefined for empty / whitespace', () => {
    expect(normalizeInvoiceNumberSearch(undefined)).toBeUndefined();
    expect(normalizeInvoiceNumberSearch('')).toBeUndefined();
    expect(normalizeInvoiceNumberSearch('   ')).toBeUndefined();
  });

  it('strips leading # like the previous client-side filter', () => {
    expect(normalizeInvoiceNumberSearch('#INV-123')).toBe('INV-123');
    expect(normalizeInvoiceNumberSearch('  #abc  ')).toBe('abc');
  });

  it('preserves trimmed query', () => {
    expect(normalizeInvoiceNumberSearch('INV-999')).toBe('INV-999');
  });
});
