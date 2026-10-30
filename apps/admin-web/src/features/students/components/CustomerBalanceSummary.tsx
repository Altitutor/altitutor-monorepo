"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { Button, Popover, PopoverAnchor, PopoverContent } from "@altitutor/ui";
import { ExternalLink } from "lucide-react";
import { stripeCustomerDashboardUrl } from "@/shared/utils/stripe-dashboard-urls";

interface CustomerBalance {
  linked?: boolean;
  stripe_customer_id?: string | null;
  balance_cents: number;
  currency: string;
}

interface BalanceHistory {
  transactions: {
    id: string;
    amount_cents: number;
    currency: string;
    type: string;
    description: string | null;
    created: number;
  }[];
  has_more: boolean;
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    currencyDisplay: "code",
  }).format(cents / 100);
}

export function CustomerBalanceSummary({ studentId }: { studentId: string }) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const triggerHovered = useRef(false);
  const contentHovered = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancel = () => clearTimeout(timer.current);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open) contentHovered.current = false;
  }, [open]);
  const hide = () => {
    cancel();
    timer.current = setTimeout(() => {
      const focused = document.activeElement;
      if (
        triggerHovered.current ||
        contentHovered.current ||
        triggerRef.current?.contains(focused) ||
        contentRef.current?.contains(focused)
      )
        return;
      setOpen(false);
    }, 200);
  };
  const balance = useQuery<CustomerBalance>({
    queryKey: ["customer-balance", studentId],
    queryFn: async () => {
      const response = await fetch(
        `/api/students/${studentId}/customer-balance`,
      );
      if (!response.ok) throw new Error("Unable to load customer balance");
      return response.json();
    },
    staleTime: 60_000,
  });
  const history = useQuery<BalanceHistory>({
    queryKey: ["customer-balance-history", studentId, "summary"],
    queryFn: async () => {
      const response = await fetch(
        `/api/students/${studentId}/customer-balance/history?limit=5`,
      );
      if (!response.ok) throw new Error("Unable to load balance history");
      return response.json();
    },
    enabled: open && balance.isSuccess && balance.data.linked !== false,
    staleTime: 60_000,
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <button
          ref={triggerRef}
          type="button"
          className="rounded-sm text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? contentId : undefined}
          onMouseEnter={() => {
            triggerHovered.current = true;
            cancel();
            timer.current = setTimeout(() => setOpen(true), 250);
          }}
          onMouseLeave={() => {
            triggerHovered.current = false;
            hide();
          }}
          onFocus={() => {
            cancel();
            setOpen(true);
          }}
          onBlur={hide}
          onClick={() => {
            cancel();
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "ArrowDown") {
              event.preventDefault();
              cancel();
              setOpen(true);
              requestAnimationFrame(() =>
                contentRef.current
                  ?.querySelector<HTMLAnchorElement>("a")
                  ?.focus(),
              );
            }
          }}
        >
          <span className="text-muted-foreground">Customer balance: </span>
          {balance.isError ? (
            "Unable to load balance"
          ) : balance.isPending ? (
            "Loading…"
          ) : balance.data.linked === false ? (
            "No Stripe customer"
          ) : (
            <span className="font-medium">
              {formatMoney(balance.data.balance_cents, balance.data.currency)}
              {balance.data.balance_cents < 0
                ? " (credit)"
                : balance.data.balance_cents > 0
                  ? " (owing)"
                  : ""}
            </span>
          )}
        </button>
      </PopoverAnchor>
      <PopoverContent
        ref={contentRef}
        id={contentId}
        aria-label="Customer balance history"
        align="end"
        className="w-80 max-w-[calc(100vw-24px)] space-y-3"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onEscapeKeyDown={() => {
          cancel();
          contentHovered.current = false;
          triggerRef.current?.focus();
          setOpen(false);
        }}
        onMouseEnter={() => {
          contentHovered.current = true;
          cancel();
        }}
        onMouseLeave={() => {
          contentHovered.current = false;
          hide();
        }}
        onFocus={cancel}
        onBlur={hide}
      >
        <h4 className="text-sm font-semibold">Recent balance history</h4>
        {balance.isError ? (
          <p role="alert" className="text-sm">
            Unable to load customer balance.
          </p>
        ) : balance.isPending ? (
          <p className="text-sm text-muted-foreground">Loading balance…</p>
        ) : balance.data.linked === false ? (
          <p className="text-sm text-muted-foreground">
            No Stripe customer linked.
          </p>
        ) : history.isError ? (
          <p role="alert" className="text-sm">
            Unable to load balance history.
          </p>
        ) : history.isPending ? (
          <p className="text-sm text-muted-foreground">Loading history…</p>
        ) : history.data.transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No balance transactions.
          </p>
        ) : (
          <ul className="space-y-3 text-sm">
            {history.data.transactions.map((transaction) => (
              <li key={transaction.id} className="space-y-0.5">
                <div className="flex justify-between gap-3">
                  <time
                    className="text-xs text-muted-foreground"
                    dateTime={new Date(
                      transaction.created * 1000,
                    ).toISOString()}
                  >
                    {new Date(transaction.created * 1000).toLocaleDateString(
                      "en-AU",
                    )}
                  </time>
                  <span className="shrink-0 font-medium">
                    {formatMoney(
                      transaction.amount_cents,
                      transaction.currency,
                    )}
                  </span>
                </div>
                <p className="break-words">
                  {transaction.description ||
                    transaction.type.replaceAll("_", " ")}
                </p>
              </li>
            ))}
          </ul>
        )}
        {history.data?.has_more && (
          <p className="text-xs text-muted-foreground">
            Showing the latest five transactions.
          </p>
        )}
        {balance.data?.stripe_customer_id && (
          <div className="border-t pt-3">
            <Button asChild variant="outline" size="sm" className="w-full">
              <a
                href={stripeCustomerDashboardUrl(
                  balance.data.stripe_customer_id,
                )}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open in Stripe{" "}
                <ExternalLink className="ml-2 h-3 w-3" aria-hidden="true" />
              </a>
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
