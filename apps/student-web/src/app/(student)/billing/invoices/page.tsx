import { CreditBalanceCard } from "@/features/billing/components/CreditBalanceCard";
import { InvoicesTable } from "@/features/billing/components/InvoicesTable";

export default function BillingInvoicesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Invoices</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          View and pay invoices for your tutoring sessions.
        </p>
      </div>
      <CreditBalanceCard />
      <InvoicesTable />
    </div>
  );
}
