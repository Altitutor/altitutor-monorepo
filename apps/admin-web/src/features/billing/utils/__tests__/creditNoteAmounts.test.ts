import { formatCreditAmountInput, getCreditAmountError, parseCreditAmountCents } from '../creditNoteAmounts';

describe('credit note amount helpers', () => {
  it('formats cents for an editable currency input', () => {
    expect(formatCreditAmountInput(3500)).toBe('35.00');
    expect(formatCreditAmountInput(1)).toBe('0.01');
  });

  it('parses dollar values into integer cents', () => {
    expect(parseCreditAmountCents('35')).toBe(3500);
    expect(parseCreditAmountCents('35.5')).toBe(3550);
    expect(parseCreditAmountCents('0.01')).toBe(1);
  });

  it('rejects empty, negative, and fractional-cent values', () => {
    expect(parseCreditAmountCents('')).toBeNull();
    expect(parseCreditAmountCents('-1')).toBeNull();
    expect(parseCreditAmountCents('1.001')).toBeNull();
  });

  it('validates the amount against the selected invoice line', () => {
    expect(getCreditAmountError('0', 3500)).toBe('Enter an amount greater than $0.00');
    expect(getCreditAmountError('35.01', 3500)).toBe('Cannot exceed $35.00');
    expect(getCreditAmountError('35.00', 3500)).toBeNull();
  });
});
