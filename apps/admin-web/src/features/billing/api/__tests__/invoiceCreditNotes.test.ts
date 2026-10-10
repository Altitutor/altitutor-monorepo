import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getInvoiceCreditNotesByInvoiceIds } from '../invoice-credit-notes';

function clientFixture(error: Error | null = null) {
  const inFilter = jest.fn(() => ({ order: async () => ({ data: [], error }) }));
  const from = jest.fn(() => ({ select: () => ({ in: inFilter }) }));
  return { client: { from } as unknown as SupabaseClient<Database>, from, inFilter };
}

it('skips empty reads and deduplicates invoice IDs', async () => {
  const { client, from, inFilter } = clientFixture();
  await getInvoiceCreditNotesByInvoiceIds(client, []);
  expect(from).not.toHaveBeenCalled();
  await getInvoiceCreditNotesByInvoiceIds(client, ['invoice-1', 'invoice-1']);
  expect(inFilter).toHaveBeenCalledWith('invoice_id', ['invoice-1']);
});

it('bounds query URLs for large session lists while reading every invoice', async () => {
  const { client, inFilter } = clientFixture();
  const ids = Array.from({ length: 401 }, (_, index) => `invoice-${index}`);
  await getInvoiceCreditNotesByInvoiceIds(client, ids);
  const batches = inFilter.mock.calls as unknown as Array<[string, string[]]>;
  expect(batches).toHaveLength(5);
  expect(batches.every(([, batch]) => batch.length <= 100)).toBe(true);
  expect(batches.flatMap(([, batch]) => batch)).toEqual(ids);
});

it('surfaces an unavailable financial read rather than treating it as no credit notes', async () => {
  const error = new Error('Unable to read credit notes');
  const { client } = clientFixture(error);
  await expect(getInvoiceCreditNotesByInvoiceIds(client, ['invoice-1'])).rejects.toBe(error);
});
