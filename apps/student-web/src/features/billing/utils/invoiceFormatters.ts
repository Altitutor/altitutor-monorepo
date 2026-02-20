/** Format invoice date (YYYY-MM-DD) in Adelaide. Value is the session/invoice date from DB (date-only, no time). */
export function formatInvoiceDate(dateString: string | null): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString + 'T12:00:00Z');
    return date.toLocaleDateString('en-AU', {
      timeZone: 'Australia/Adelaide',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}
