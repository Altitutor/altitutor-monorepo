"use client";
import { useEntityPageRequest } from "@/shared/hooks/useEntityPageRequest";

type ViewInvoiceModalProps = {
  isOpen: boolean;
  invoiceId: string | null;
  onClose: () => void;
};

/** Legacy selection adapter. Entity content now lives in its full page. */
export function ViewInvoiceModal({ isOpen, invoiceId, onClose }: ViewInvoiceModalProps) {
  useEntityPageRequest(isOpen, invoiceId ? `/invoices/${invoiceId}` : null, onClose);
  return null;
}
