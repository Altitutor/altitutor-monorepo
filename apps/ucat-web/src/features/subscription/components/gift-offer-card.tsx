import React, { type ReactNode } from "react";
import { Gift, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared presentation for friend invitations and founder offers. */
export function GiftOfferCard({
  eyebrow,
  title,
  description,
  note,
  actions,
  error,
  tone = "theme",
}: {
  eyebrow: string;
  title: string;
  description: ReactNode;
  note: ReactNode;
  actions: ReactNode;
  error?: string | null;
  /** Marketing pages stay on the light palette even when the app is in dark mode. */
  tone?: "theme" | "marketing";
}) {
  const marketing = tone === "marketing";
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border p-6 shadow-sm sm:p-8",
        marketing
          ? "border-marketing-primary/25 bg-gradient-to-br from-marketing-primary/[0.14] via-white to-marketing-cream dark:border-marketing-primary/25 dark:from-marketing-primary/[0.14] dark:via-white dark:to-marketing-cream"
          : "border-primary/25 bg-gradient-to-br from-primary/[0.14] via-background to-background",
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "absolute -right-16 -top-16 h-52 w-52 rounded-full blur-3xl",
          marketing
            ? "bg-marketing-primary/15 dark:bg-marketing-primary/15"
            : "bg-primary/15",
        )}
      />
      <div className="relative">
        <div className="flex items-start gap-4">
          <span
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm",
              marketing
                ? "bg-marketing-primary text-white dark:bg-marketing-primary dark:text-white"
                : "bg-primary text-primary-foreground",
            )}
          >
            <Gift className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p
              className={cn(
                "text-xs font-semibold uppercase tracking-[0.18em]",
                marketing
                  ? "text-marketing-primary dark:text-marketing-primary"
                  : "text-primary",
              )}
            >
              {eyebrow}
            </p>
            <h2
              className={cn(
                "mt-2 text-2xl font-semibold tracking-tight sm:text-3xl",
                marketing &&
                  "text-marketing-charcoal dark:text-marketing-charcoal",
              )}
            >
              {title}
            </h2>
            <p
              className={cn(
                "mt-3 max-w-2xl leading-relaxed",
                marketing
                  ? "text-marketing-charcoal/60 dark:text-marketing-charcoal/60"
                  : "text-muted-foreground",
              )}
            >
              {description}
            </p>
          </div>
        </div>
        <div
          className={cn(
            "mt-6 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between",
            marketing
              ? "border-marketing-charcoal/10 bg-white/70 dark:border-marketing-charcoal/10 dark:bg-white/70"
              : "border-border/70 bg-background/70",
          )}
        >
          <div
            className={cn(
              "flex items-center gap-2 text-sm",
              marketing
                ? "text-marketing-charcoal/60 dark:text-marketing-charcoal/60"
                : "text-muted-foreground",
            )}
          >
            <ShieldCheck
              className={cn(
                "h-4 w-4 shrink-0",
                marketing
                  ? "text-marketing-primary dark:text-marketing-primary"
                  : "text-primary",
              )}
              aria-hidden="true"
            />
            <span>{note}</span>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap">
            {actions}
          </div>
        </div>
        {error ? (
          <p
            role="alert"
            className={cn(
              "mt-3 text-sm",
              marketing
                ? "text-red-600 dark:text-red-600"
                : "text-destructive",
            )}
          >
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
