"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  MARKETING_TOKENS,
  maxPracticeDayDiscountCents,
  type UcatBillingInterval,
} from "@altitutor/shared";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@altitutor/ui";
import {
  CalendarRange,
  Check,
  CircleDollarSign,
  ClipboardList,
  Dumbbell,
  FileCheck2,
  Gift,
  Layers,
  Minus,
  X,
  type LucideIcon,
} from "lucide-react";
import { UCAT_SECTION_EYEBROW_CLASS, UCAT_SECTION_PADDING_CLASS } from "./ucat-landing-section-eyebrow";

const { typography: typo } = MARKETING_TOKENS;

type CompetitorKey = "altitutor" | "medentry" | "medify";
type StatusValue = "yes" | "partial" | "no";

type StatusCell = {
  status: StatusValue;
  detail?: string;
};

type CostCell = {
  value: string;
  originalValue?: string;
  subtext?: string;
  detail?: string;
};

type ComparisonRow =
  | {
      id: string;
      label: string;
      icon: LucideIcon;
      kind: "cost";
      cells: Record<CompetitorKey, CostCell>;
    }
  | {
      id: string;
      label: string;
      icon: LucideIcon;
      kind: "status";
      cells: Record<CompetitorKey, StatusCell>;
    };

type PublicSubscriptionConfig = {
  currency: string;
  planPrices: Array<{
    tier: string;
    interval: UcatBillingInterval;
    basePriceCents: number;
    checkoutEnabled: boolean;
    configured: boolean;
  }>;
  practiceDayDiscounts: Array<{
    interval: UcatBillingInterval;
    discountPerDayCents: number;
    maxDiscountsPerPeriod: number;
  }>;
};

const COMPETITORS: Array<{
  key: CompetitorKey;
  name: string;
  highlight?: boolean;
}> = [
  { key: "altitutor", name: "Altitutor UCAT", highlight: true },
  { key: "medentry", name: "MedEntry" },
  { key: "medify", name: "Medify" },
];

const STATUS_ROWS: Extract<ComparisonRow, { kind: "status" }>[] = [
  {
    id: "skill-trainers",
    label: "Skill trainers",
    icon: Dumbbell,
    kind: "status",
    cells: {
      altitutor: {
        status: "yes",
        detail: "Targeted drills for core UCAT skills inside guided learning.",
      },
      medentry: {
        status: "yes",
        detail: "Includes MedEntry skills trainers on the online platform.",
      },
      medify: {
        status: "yes",
        detail: "Includes Medify skill trainers with a paid subscription.",
      },
    },
  },
  {
    id: "practice-questions",
    label: "Practice questions",
    icon: ClipboardList,
    kind: "status",
    cells: {
      altitutor: {
        status: "yes",
        detail:
          "Practice across every UCAT section, with Free allowances or Unlimited access.",
      },
      medentry: {
        status: "yes",
        detail: "Large question bank on the MedEntry online platform.",
      },
      medify: {
        status: "yes",
        detail: "Large UCAT question bank with explanations on Medify.",
      },
    },
  },
  {
    id: "full-sets",
    label: "Full sets",
    icon: Layers,
    kind: "status",
    cells: {
      altitutor: {
        status: "yes",
        detail: "Timed section sets that mirror exam pacing and structure.",
      },
      medentry: {
        status: "yes",
        detail: "Subtest and practice sets on the MedEntry platform.",
      },
      medify: {
        status: "yes",
        detail: "Section practice sets included with Medify access.",
      },
    },
  },
  {
    id: "full-mocks",
    label: "Full mocks",
    icon: FileCheck2,
    kind: "status",
    cells: {
      altitutor: {
        status: "yes",
        detail: "Full-length mocks with review, timing, and score insight.",
      },
      medentry: {
        status: "yes",
        detail: "Full mocks and subtest mocks on the MedEntry platform.",
      },
      medify: {
        status: "yes",
        detail: "Full mocks and mini-mocks included with Medify access.",
      },
    },
  },
  {
    id: "adaptive-study-plan",
    label: "Adaptive study plan",
    icon: CalendarRange,
    kind: "status",
    cells: {
      altitutor: {
        status: "yes",
        detail:
          "Builds and rebalances around your target, test date, and evidenced weaknesses—not a static calendar.",
      },
      medentry: {
        status: "partial",
        detail:
          "MedEntry includes an interactive study planner/calendar, but it is not adaptive to your weaknesses.",
      },
      medify: {
        status: "no",
        detail:
          "No weakness-adaptive study plan that continuously rebalances your next steps.",
      },
    },
  },
  {
    id: "free-forever",
    label: "Free forever",
    icon: Gift,
    kind: "status",
    cells: {
      altitutor: {
        status: "yes",
        detail:
          "Ongoing Free access with reset allowances—not a short trial that locks you out.",
      },
      medentry: {
        status: "no",
        detail: "Full platform access requires a paid package.",
      },
      medify: {
        status: "partial",
        detail:
          "Medify offers limited free content. Full practice, trainers, and mocks require a paid subscription.",
      },
    },
  },
];

const GRID_COLS =
  "grid-cols-[minmax(11rem,1.35fr)_repeat(3,minmax(7rem,1fr))]";

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function StatusIcon({ status }: { status: StatusValue }) {
  switch (status) {
    case "yes":
      return (
        <span className="inline-flex size-8 items-center justify-center rounded-full bg-marketing-primary text-white">
          <Check className="size-4" strokeWidth={2.5} aria-hidden />
        </span>
      );
    case "partial":
      return (
        <span className="inline-flex size-8 items-center justify-center rounded-full bg-amber-500 text-white">
          <Minus className="size-4" strokeWidth={2.5} aria-hidden />
        </span>
      );
    case "no":
      return (
        <span className="inline-flex size-8 items-center justify-center rounded-full bg-marketing-charcoal/[0.06] text-marketing-charcoal/35">
          <X className="size-4" strokeWidth={2.5} aria-hidden />
        </span>
      );
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function statusLabel(status: StatusValue): string {
  switch (status) {
    case "yes":
      return "Included";
    case "partial":
      return "Partial";
    case "no":
      return "Not included";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function DetailTooltip({
  label,
  detail,
  children,
}: {
  label: string;
  detail?: string;
  children: ReactNode;
}) {
  if (!detail) return <>{children}</>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex cursor-help rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-marketing-primary/40"
          aria-label={`${label}: more detail`}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className={`max-w-64 border border-marketing-charcoal/10 bg-white px-3 py-2 text-left text-marketing-charcoal shadow-lg ${typo.secondarySans}`}
      >
        <p className="text-xs font-semibold text-marketing-charcoal">{label}</p>
        <p className="mt-1 text-xs leading-relaxed text-marketing-charcoal/60">
          {detail}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

export function UcatLandingComparison() {
  const [config, setConfig] = useState<PublicSubscriptionConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ucat/subscription-config/")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Pricing request failed (${response.status})`);
        }
        return (await response.json()) as PublicSubscriptionConfig;
      })
      .then((next) => {
        if (!cancelled) setConfig(next);
      })
      .catch(() => {
        if (!cancelled) setConfig(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const altitutorCost = useMemo(() => {
    const interval: UcatBillingInterval = "month";
    const priceRow = config?.planPrices.find(
      (price) => price.tier === "unlimited" && price.interval === interval,
    );
    const discount = config?.practiceDayDiscounts.find(
      (row) => row.interval === interval,
    );
    if (!priceRow || !discount) {
      return {
        value: "—",
        subtext: "with practice discounts",
        detail: "Live Altitutor pricing could not be loaded.",
      } satisfies CostCell;
    }

    const currency = config?.currency ?? "AUD";
    const discountedPeriodCents = Math.max(
      0,
      priceRow.basePriceCents -
        maxPracticeDayDiscountCents(
          discount.discountPerDayCents,
          discount.maxDiscountsPerPeriod,
        ),
    );

    return {
      originalValue: `${formatMoney(priceRow.basePriceCents, currency)}/mo`,
      value: `${formatMoney(discountedPeriodCents, currency)}/mo`,
      subtext: "with practice discounts",
      detail: `Standard price ${formatMoney(priceRow.basePriceCents, currency)}/mo without practice discounts.`,
    } satisfies CostCell;
  }, [config]);

  const rows: ComparisonRow[] = useMemo(
    () => [
      ...STATUS_ROWS,
      {
        id: "cost",
        label: "Cost for full platform",
        icon: CircleDollarSign,
        kind: "cost",
        cells: {
          altitutor: altitutorCost,
          medentry: {
            value: "$360/yr",
            detail:
              "MedEntry Essential list price for full online platform access until the end of the UCAT testing period. Sale prices and higher-tier packages vary.",
          },
          medify: {
            value: "$65/mo",
            detail:
              "Medify yearly subscription (AUD) for full platform access. Monthly plans are also available.",
          },
        },
      },
    ],
    [altitutorCost],
  );

  return (
    <section
      id="comparison"
      className={`bg-white ${UCAT_SECTION_PADDING_CLASS}`}
    >
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <p
            className={`${UCAT_SECTION_EYEBROW_CLASS} ${typo.dataMono}`}
          >
            Comparison
          </p>
          <h2
            className={`mt-4 text-4xl font-semibold tracking-[-0.035em] text-marketing-charcoal sm:text-5xl ${typo.headingSans}`}
          >
            How Altitutor UCAT compares
          </h2>
          <p
            className={`mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-marketing-charcoal/60 sm:text-xl ${typo.secondarySans}`}
          >
            See how Altitutor UCAT stacks up against other platforms.
          </p>
        </div>

        <TooltipProvider delayDuration={150}>
          <div className="mt-14 overflow-x-auto pb-2">
            <div className="relative min-w-[42rem]">
              {/* Continuous highlight behind the Altitutor UCAT column */}
              <div
                aria-hidden
                className={`pointer-events-none absolute inset-0 z-0 grid ${GRID_COLS} gap-x-2 px-2 sm:gap-x-3`}
              >
                <div />
                <div className="-mx-1 rounded-[1.75rem] border border-marketing-accent/70 bg-marketing-cream/40 sm:-mx-1.5" />
                <div />
                <div />
              </div>

              <div
                className={`relative z-10 grid ${GRID_COLS} gap-x-2 px-2 sm:gap-x-3`}
              >
                <div aria-hidden className="min-h-16" />
                {COMPETITORS.map((competitor) => (
                  <div
                    key={competitor.key}
                    className="flex min-h-16 flex-col items-center justify-end px-2 pb-5 pt-5 text-center"
                  >
                    <p
                      className={`text-sm font-semibold leading-snug sm:text-base ${typo.headingSans} ${
                        competitor.highlight
                          ? "text-marketing-primary"
                          : "text-marketing-charcoal"
                      }`}
                    >
                      {competitor.name}
                    </p>
                  </div>
                ))}

                {rows.map((row) => (
                  <div key={row.id} className="contents">
                    <div className="flex items-center gap-3 border-t border-marketing-charcoal/[0.08] py-4 pr-2 sm:py-5">
                      <span className="hidden size-9 shrink-0 items-center justify-center rounded-full bg-marketing-charcoal/[0.05] text-marketing-charcoal/45 sm:inline-flex">
                        <row.icon className="size-4" aria-hidden />
                      </span>
                      <span
                        className={`text-sm font-medium text-marketing-charcoal sm:text-[15px] ${typo.secondarySans}`}
                      >
                        {row.label}
                      </span>
                    </div>

                    {COMPETITORS.map((competitor) => {
                      const highlighted = Boolean(competitor.highlight);

                      if (row.kind === "cost") {
                        const cell = row.cells[competitor.key];
                        return (
                          <div
                            key={competitor.key}
                            className="flex items-center justify-center border-t border-marketing-charcoal/[0.08] px-2 py-4 sm:py-5"
                          >
                            <DetailTooltip
                              label={`${competitor.name} · ${row.label}`}
                              detail={cell.detail}
                            >
                              <span className="inline-flex flex-col items-center gap-0.5 text-center">
                                <span
                                  className={`inline-flex flex-wrap items-center justify-center gap-x-1.5 text-sm font-semibold tabular-nums sm:text-base ${typo.headingSans}`}
                                >
                                  {cell.originalValue ? (
                                    <span
                                      className={
                                        highlighted
                                          ? "text-marketing-charcoal/35 line-through decoration-marketing-charcoal/25"
                                          : "text-marketing-charcoal/35 line-through"
                                      }
                                    >
                                      {cell.originalValue}
                                    </span>
                                  ) : null}
                                  <span
                                    className={
                                      highlighted
                                        ? "text-marketing-primary"
                                        : "text-marketing-charcoal"
                                    }
                                  >
                                    {cell.value}
                                  </span>
                                </span>
                                {cell.subtext ? (
                                  <span
                                    className={`max-w-[7.5rem] text-[10px] leading-snug text-marketing-charcoal/45 ${typo.secondarySans}`}
                                  >
                                    {cell.subtext}
                                  </span>
                                ) : null}
                              </span>
                            </DetailTooltip>
                          </div>
                        );
                      }

                      const cell = row.cells[competitor.key];
                      return (
                        <div
                          key={competitor.key}
                          className="flex items-center justify-center border-t border-marketing-charcoal/[0.08] py-4 sm:py-5"
                        >
                          <DetailTooltip
                            label={`${competitor.name} · ${row.label}`}
                            detail={cell.detail}
                          >
                            <span className="inline-flex flex-col items-center gap-1">
                              <StatusIcon status={cell.status} />
                              <span className="sr-only">
                                {statusLabel(cell.status)}
                              </span>
                            </span>
                          </DetailTooltip>
                        </div>
                      );
                    })}
                  </div>
                ))}

                <div aria-hidden className="h-5" />
                <div aria-hidden className="h-5" />
                <div aria-hidden className="h-5" />
                <div aria-hidden className="h-5" />
              </div>
            </div>
          </div>
        </TooltipProvider>
      </div>
    </section>
  );
}
