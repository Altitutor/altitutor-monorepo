import assert from 'node:assert/strict';
import test from 'node:test';

import { invoiceListSubtitle, invoiceListTitle } from './invoice-list';

test('invoice rows use the invoice number and line items', () => {
  assert.equal(invoiceListTitle({ stripe_invoice_number: ' INV-14 ' }), 'INV-14');
  assert.equal(invoiceListTitle({ stripe_invoice_number: '  ' }), 'Invoice');
  assert.equal(invoiceListSubtitle([
    { description: 'Year 10 Maths', subject_name: 'Maths', is_subsidy: false },
    { description: null, subject_name: 'Subsidy', is_subsidy: true },
    { description: '  ', subject_name: 'English', is_subsidy: false },
  ]), 'Year 10 Maths, English');
  assert.equal(invoiceListSubtitle([]), 'No line items');
});
