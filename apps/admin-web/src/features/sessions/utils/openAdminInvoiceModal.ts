/** Opens ViewInvoiceModal via MentionModalProvider (same as mention invoice links). */
export function openAdminInvoiceModal(invoiceId: string): void {
  window.dispatchEvent(
    new CustomEvent('mentionClick', {
      detail: { id: invoiceId, type: 'invoice' },
    })
  );
}
