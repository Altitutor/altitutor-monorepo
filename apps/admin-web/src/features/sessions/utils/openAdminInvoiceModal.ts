/** Opens ViewInvoiceModal through the root entity modal provider. */
export function openAdminInvoiceModal(invoiceId: string): void {
  window.dispatchEvent(
    new CustomEvent('mentionClick', {
      detail: { id: invoiceId, type: 'invoice' },
    })
  );
}
