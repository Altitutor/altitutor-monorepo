"use client";

import { Skeleton } from "@altitutor/ui";
import { studentCardCn } from "@/shared/lib/student-visual";
import { useCreditBalance } from "../hooks/useCreditBalance";

function formatBalance(balanceCents: number, currency: string): string {
  const amount = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(Math.abs(balanceCents) / 100);

  return `${balanceCents < 0 ? "-" : ""}${amount} ${currency.toUpperCase()}`;
}

export function CreditBalanceCard() {
  const { data, isLoading, isError } = useCreditBalance();

  if (isLoading) {
    return (
      <div className={studentCardCn("p-5")} aria-label="Loading credit balance">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-3 h-9 w-44" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={studentCardCn("p-5")} role="status">
        <p className="text-sm font-medium">Credit balance unavailable</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your invoices are still available below. Try refreshing the page to
          check your credit.
        </p>
      </div>
    );
  }

  const isCredit = data.balance_cents < 0;

  return (
    <section
      className={studentCardCn("p-5")}
      aria-labelledby="credit-balance-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p
            id="credit-balance-heading"
            className="text-sm text-muted-foreground"
          >
            Current balance
          </p>
          <p
            className={`mt-1 text-3xl font-bold tabular-nums ${
              isCredit
                ? "text-green-600 dark:text-green-400"
                : "text-foreground"
            }`}
          >
            {formatBalance(data.balance_cents, data.currency)}
          </p>
        </div>
        {isCredit ? (
          <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700 dark:bg-green-900/20 dark:text-green-400">
            Credit available
          </span>
        ) : null}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        {isCredit
          ? "Your credit will be automatically applied to future invoices."
          : data.balance_cents > 0
            ? "This amount is currently owed on your billing account."
            : "No credit is currently available on your billing account."}
      </p>
    </section>
  );
}
