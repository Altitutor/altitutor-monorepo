import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getStudentInvoiceOwing } from '../student-invoice-owing';

const invoice = (id: number, overrides = {}) => ({
  id: String(id).padStart(8, '0'), student_id: 'student', status: 'open',
  deleted_at: null, finalized_at: '2026-10-01', currency: 'aud',
  amount_due_cents: 100, amount_paid_cents: 25, ...overrides,
});
type Row = ReturnType<typeof invoice>;

function fixture(rows: Row[], failPage?: number) {
  const ranges: number[] = [];
  const client = { from: () => {
    let filtered = rows;
    const query = {
      select: () => query,
      eq: (column: keyof Row, value: unknown) => {
        filtered = filtered.filter(row => row[column] === value); return query;
      },
      is: (column: keyof Row, value: unknown) => {
        filtered = filtered.filter(row => row[column] === value); return query;
      },
      not: (column: keyof Row, _operator: string, value: unknown) => {
        filtered = filtered.filter(row => row[column] !== value); return query;
      },
      order: () => { filtered = [...filtered].sort((a,b) => a.id.localeCompare(b.id)); return query; },
      range: async (from: number, to: number) => {
        ranges.push(from);
        return {data: filtered.slice(from, to+1), error: from === failPage ? new Error('Financial read unavailable') : null};
      },
    };
    return query;
  }} as unknown as SupabaseClient<Database>;
  return {client, ranges};
}

it('includes every finalized open invoice across page boundaries and keeps currencies separate', async () => {
  const rows = Array.from({length: 1001}, (_,i) => invoice(i));
  rows.push(invoice(1002, {currency: 'USD', amount_due_cents: 10000, amount_paid_cents: 2500}));
  rows.push(invoice(1003, {currency: 'usd', amount_due_cents: 500, amount_paid_cents: 100}));
  const {client, ranges} = fixture(rows.reverse());
  expect(await getStudentInvoiceOwing(client, 'student')).toEqual([
    {currency: 'AUD', amountCents: 75075}, {currency: 'USD', amountCents: 7900},
  ]);
  expect(ranges).toEqual([0,1000]);
});

it('excludes other students, deleted/unfinalized and non-open invoices', async () => {
  const rows = [invoice(1), invoice(2,{student_id:'other'}), invoice(3,{deleted_at:'2026-10-02'}),
    invoice(4,{finalized_at:null}), ...['draft','paid','void','uncollectible','disputed'].map((status,i)=>invoice(i+5,{status}))];
  expect(await getStudentInvoiceOwing(fixture(rows).client,'student')).toEqual([{currency:'AUD',amountCents:75}]);
});

it('does not return a partial total after a later page fails', async () => {
  const {client} = fixture(Array.from({length:1001},(_,i)=>invoice(i)),1000);
  await expect(getStudentInvoiceOwing(client,'student')).rejects.toThrow('Financial read unavailable');
});

it('handles an exact page boundary and an empty student', async () => {
  const {client,ranges}=fixture(Array.from({length:1000},(_,i)=>invoice(i)));
  expect(await getStudentInvoiceOwing(client,'student')).toEqual([{currency:'AUD',amountCents:75000}]);
  expect(ranges).toEqual([0,1000]);
  expect(await getStudentInvoiceOwing(fixture([]).client,'student')).toEqual([]);
});
