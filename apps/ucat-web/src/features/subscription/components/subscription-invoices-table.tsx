"use client";

import { Button } from "@/components/ui/button";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, PAID_INVOICE_BADGE_VARIANT } from "@altitutor/ui";
import { ExternalLink } from "lucide-react";
import type { UcatSubscriptionInvoice } from "@/features/subscription/types/ucat-subscription-billing";
import {
  formatAmount,
  formatInvoiceDate,
  getInvoiceTotalAmount,
  isInvoiceOverdue,
} from "@/features/subscription/lib/invoice-display";
import {
  UCAT_HEADER_BTN_OUTLINE,
  UCAT_TABLE_BODY_ROW,
  UCAT_TABLE_HEADER_CLASSNAME,
  UCAT_TABLE_HEADER_ROW,
  UCAT_TABLE_SHELL,
} from "@/lib/ucat-surface-motion";

function getLineItemsDisplay(
  items: UcatSubscriptionInvoice["items"],
): Array<{ label: string; amountCents: number | null }> {
  return items
    .map((item) => ({
      label: item.description?.trim() || item.subject_name?.trim() || "",
      amountCents: item.amount_cents ?? null,
    }))
    .filter((item) => item.label.length > 0);
}

type SubscriptionInvoicesTableProps = {
  invoices: UcatSubscriptionInvoice[];
};

export function SubscriptionInvoicesTable({
  invoices,
}: SubscriptionInvoicesTableProps) {
  return (
    <div className={UCAT_TABLE_SHELL}>
      <Table>
        <TableHeader className={UCAT_TABLE_HEADER_CLASSNAME}>
          <TableRow className={UCAT_TABLE_HEADER_ROW}>
            <TableHead>Date</TableHead>
            <TableHead>Line items</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.length === 0 ? (
            <TableRow className={UCAT_TABLE_BODY_ROW}>
              <TableCell
                colSpan={5}
                className="h-24 text-center text-muted-foreground"
              >
                No subscription invoices yet
              </TableCell>
            </TableRow>
          ) : (
            invoices.map((invoice) => {
              const overdue = isInvoiceOverdue(invoice);
              const lineItems = getLineItemsDisplay(invoice.items);

              return (
                <TableRow key={invoice.id} className={UCAT_TABLE_BODY_ROW}>
                  <TableCell>{formatInvoiceDate(invoice.invoice_date)}</TableCell>
                  <TableCell className="max-w-sm">
                    {lineItems.length ? (
                      <div className="space-y-1">
                        {lineItems.map((item, itemIndex) => (
                          <div
                            key={`${invoice.id}-line-${itemIndex}`}
                            className="flex items-center gap-2"
                          >
                            <span className="min-w-0 flex-1 truncate text-sm">
                              {item.label}
                            </span>
                            <span className="shrink-0 text-xs tabular-nums text-muted-foreground opacity-70">
                              {formatAmount(item.amountCents)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatAmount(getInvoiceTotalAmount(invoice))}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {overdue && <Badge variant="destructive">Overdue</Badge>}
                      {(invoice.status === "paid" || invoice.paid_at) && (
                        <Badge variant={PAID_INVOICE_BADGE_VARIANT}>
                          {invoice.paid_at
                            ? `Paid ${new Date(invoice.paid_at).toLocaleDateString("en-AU")}`
                            : "Paid"}
                        </Badge>
                      )}
                      {invoice.status === "draft" && (
                        <Badge variant="outline">Draft</Badge>
                      )}
                      {invoice.status === "open" && !overdue && (
                        <Badge variant="secondary">Open</Badge>
                      )}
                      {["void", "uncollectible", "disputed"].includes(
                        invoice.status || "",
                      ) && (
                        <Badge variant="destructive">
                          {(invoice.status || "")
                            .charAt(0)
                            .toUpperCase() + (invoice.status || "").slice(1)}
                        </Badge>
                      )}
                      {!invoice.status && "-"}
                    </div>
                  </TableCell>
                  <TableCell>
                    {invoice.hosted_invoice_url ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className={UCAT_HEADER_BTN_OUTLINE}
                        asChild
                      >
                        <a
                          href={invoice.hosted_invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="mr-1 h-4 w-4" />
                          View
                        </a>
                      </Button>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
