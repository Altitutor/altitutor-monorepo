import React, { type ReactNode } from "react";
import { Gift, ShieldCheck } from "lucide-react";

/** Shared presentation for friend invitations and founder offers. */
export function GiftOfferCard({
  eyebrow,
  title,
  description,
  note,
  actions,
  error,
}: {
  eyebrow: string;
  title: string;
  description: ReactNode;
  note: ReactNode;
  actions: ReactNode;
  error?: string | null;
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/[0.14] via-background to-background p-6 shadow-sm sm:p-8">
      <div
        aria-hidden="true"
        className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-primary/15 blur-3xl"
      />
      <div className="relative">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Gift className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              {eyebrow}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              {title}
            </h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/70 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck
              className="h-4 w-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span>{note}</span>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap">
            {actions}
          </div>
        </div>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
