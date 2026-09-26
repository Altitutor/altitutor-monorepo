export function formatCreditAmountInput(amountCents: number): string {
  return (amountCents / 100).toFixed(2);
}

export function parseCreditAmountCents(value: string): number | null {
  const normalized = value.trim();
  if (!/^(?:\d+|\d*\.\d{1,2})$/.test(normalized)) return null;

  const [wholePart = '0', decimalPart = ''] = normalized.split('.');
  const amountCents = Number(wholePart || '0') * 100 + Number(decimalPart.padEnd(2, '0'));

  return Number.isSafeInteger(amountCents) ? amountCents : null;
}

export function getCreditAmountError(value: string, maximumCents: number): string | null {
  const amountCents = parseCreditAmountCents(value);

  if (amountCents === null || amountCents <= 0) {
    return 'Enter an amount greater than $0.00';
  }

  if (amountCents > maximumCents) {
    return `Cannot exceed $${formatCreditAmountInput(maximumCents)}`;
  }

  return null;
}
