"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { UCAT_CONTROL_PRESS } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

export type HeaderStatusPillVariant = "amber" | "emerald" | "sky" | "rose";

const VARIANT_STYLES: Record<
  HeaderStatusPillVariant,
  { pill: string; action: string; dismiss: string }
> = {
  amber: {
    pill: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-50",
    action:
      "bg-amber-900 text-amber-50 hover:bg-amber-800 dark:bg-amber-100 dark:text-amber-950 dark:hover:bg-amber-200",
    dismiss:
      "text-amber-900/70 hover:bg-amber-900/10 hover:text-amber-900 dark:text-amber-100/70 dark:hover:bg-amber-100/10 dark:hover:text-amber-100",
  },
  emerald: {
    pill: "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-50",
    action:
      "bg-emerald-900 text-emerald-50 hover:bg-emerald-800 dark:bg-emerald-100 dark:text-emerald-950 dark:hover:bg-emerald-200",
    dismiss:
      "text-emerald-900/70 hover:bg-emerald-900/10 hover:text-emerald-900 dark:text-emerald-100/70 dark:hover:bg-emerald-100/10 dark:text-emerald-100",
  },
  sky: {
    pill: "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-50",
    action:
      "bg-sky-900 text-sky-50 hover:bg-sky-800 dark:bg-sky-100 dark:text-sky-950 dark:hover:bg-sky-200",
    dismiss:
      "text-sky-900/70 hover:bg-sky-900/10 hover:text-sky-900 dark:text-sky-100/70 dark:hover:bg-sky-100/10 dark:hover:text-sky-100",
  },
  rose: {
    pill: "border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-50",
    action:
      "bg-rose-900 text-rose-50 hover:bg-rose-800 dark:bg-rose-100 dark:text-rose-950 dark:hover:bg-rose-200",
    dismiss:
      "text-rose-900/70 hover:bg-rose-900/10 hover:text-rose-900 dark:text-rose-100/70 dark:hover:bg-rose-100/10 dark:hover:text-rose-100",
  },
};

type HeaderStatusPillAction =
  | {
      type: "link";
      href: string;
      label: string;
    }
  | {
      type: "button";
      label: string;
      onClick: () => void;
    };

type HeaderStatusPillProps = {
  variant: HeaderStatusPillVariant;
  icon: ReactNode;
  children: ReactNode;
  action?: HeaderStatusPillAction;
  onDismiss?: () => void;
  dismissLabel?: string;
};

export function HeaderStatusPill({
  variant,
  icon,
  children,
  action,
  onDismiss,
  dismissLabel = "Dismiss",
}: HeaderStatusPillProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <div
      role="status"
      className={cn(
        "inline-flex min-w-0 w-max max-w-full shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs shadow-sm",
        styles.pill,
      )}
    >
      <span className="shrink-0" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 truncate">{children}</span>
      {action ? (
        action.type === "link" ? (
          <Link
            href={action.href}
            prefetch={false}
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 font-medium",
              UCAT_CONTROL_PRESS,
              styles.action,
            )}
          >
            {action.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 font-medium",
              UCAT_CONTROL_PRESS,
              styles.action,
            )}
          >
            {action.label}
          </button>
        )
      ) : null}
      {onDismiss ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDismiss();
          }}
          className={cn(
            "shrink-0 rounded-full p-0.5",
            UCAT_CONTROL_PRESS,
            styles.dismiss,
          )}
          aria-label={dismissLabel}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
