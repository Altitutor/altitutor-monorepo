import { cn } from "@/lib/utils";

export type PlanPickerSurfaceTheme = "marketing" | "app";

export type PlanPickerSurfaceClasses = {
  error: string;
  freeCard: string;
  freeCardRing: string;
  currentPlanBadge: string;
  tierLabelMuted: string;
  tierLabelAccent: string;
  heading: string;
  description: string;
  price: string;
  priceMuted: string;
  priceCaption: string;
  featureItem: string;
  featureText: string;
  featureHeader: string;
  unlimitedCard: string;
  unlimitedGlow: string;
  comingSoon: string;
  trialBadge: string;
};

export function planPickerSurface(
  theme: PlanPickerSurfaceTheme,
): PlanPickerSurfaceClasses {
  if (theme === "marketing") {
    return {
      error: "bg-red-500/10 text-red-600",
      freeCard: "bg-white shadow-lg",
      freeCardRing: "ring-black/5 hover:shadow-xl",
      currentPlanBadge: "bg-marketing-primary/10 text-marketing-primary",
      tierLabelMuted: "text-marketing-charcoal/50",
      tierLabelAccent: "text-marketing-primary",
      heading: "text-marketing-charcoal",
      description: "text-marketing-charcoal/60",
      price: "text-marketing-charcoal",
      priceMuted: "text-marketing-charcoal/50",
      priceCaption: "text-marketing-charcoal/50",
      featureItem: "text-marketing-primary",
      featureText: "text-marketing-charcoal/70",
      featureHeader: "text-marketing-charcoal/80",
      unlimitedCard: "bg-white shadow-lg ring-black/5 hover:shadow-xl hover:ring-marketing-primary/20",
      unlimitedGlow: "bg-marketing-primary/8",
      comingSoon: "text-marketing-charcoal/50",
      trialBadge: "bg-marketing-primary/10 text-marketing-primary",
    };
  }

  return {
    error: "bg-destructive/10 text-destructive",
    freeCard: "bg-card shadow-sm",
    freeCardRing: "ring-border/60 hover:shadow-md hover:ring-primary/25",
    currentPlanBadge: "bg-primary/10 text-primary",
    tierLabelMuted: "text-muted-foreground",
    tierLabelAccent: "text-primary",
    heading: "text-foreground",
    description: "text-muted-foreground",
    price: "text-foreground",
    priceMuted: "text-muted-foreground",
    priceCaption: "text-muted-foreground",
    featureItem: "text-primary",
    featureText: "text-muted-foreground",
    featureHeader: "text-foreground/80",
    unlimitedCard:
      "bg-card shadow-sm ring-border/60 hover:shadow-md hover:ring-primary/30",
    unlimitedGlow: "bg-primary/10",
    comingSoon: "text-muted-foreground",
    trialBadge: "bg-primary/10 text-primary",
  };
}

export function planPickerCurrentPlanCtaClass(
  theme: PlanPickerSurfaceTheme,
): string {
  if (theme === "marketing") {
    return "cursor-not-allowed border border-marketing-charcoal/15 bg-marketing-charcoal/5 text-marketing-charcoal/45 shadow-none hover:bg-marketing-charcoal/5";
  }
  return "cursor-not-allowed border border-border bg-muted text-muted-foreground shadow-none hover:bg-muted";
}

/** Current plan CTA on the featured (Pro) card. */
export function planPickerFeaturedCurrentPlanCtaClass(): string {
  return "cursor-not-allowed border border-marketing-cream/20 bg-marketing-cream/10 text-marketing-cream/50 shadow-none hover:bg-marketing-cream/10";
}

export function planPickerDowngradeCtaClass(
  theme: PlanPickerSurfaceTheme,
  featured = false,
): string {
  if (featured) {
    return "border border-marketing-cream/30 bg-transparent text-marketing-cream/80 hover:bg-marketing-cream/10";
  }
  if (theme === "marketing") {
    return "border border-marketing-charcoal/25 bg-transparent text-marketing-charcoal/70 hover:bg-marketing-charcoal/5";
  }
  return "border border-border bg-transparent text-muted-foreground hover:bg-muted";
}

export function planPickerCtaClass(
  variant: "free" | "proAccent" | "monthlyFeatured",
  theme: PlanPickerSurfaceTheme,
): string {
  if (theme === "marketing") {
    return {
      free: "border border-marketing-charcoal/30 bg-transparent text-marketing-charcoal hover:bg-marketing-charcoal/5",
      proAccent:
        "bg-marketing-accent text-marketing-charcoal shadow-lg shadow-marketing-accent/30",
      monthlyFeatured:
        "bg-marketing-accent text-marketing-charcoal shadow-lg shadow-marketing-accent/30",
    }[variant];
  }

  return {
    free: "border border-border bg-transparent text-foreground hover:bg-muted",
    proAccent:
      "bg-marketing-accent text-marketing-charcoal shadow-lg shadow-marketing-accent/25",
    monthlyFeatured:
      "bg-marketing-accent text-marketing-charcoal shadow-lg shadow-marketing-accent/25",
  }[variant];
}

export function paidTierPriceClasses(
  theme: PlanPickerSurfaceTheme,
  featured: boolean,
) {
  if (featured) {
    return {
      muted: "text-marketing-cream/50",
      body: "text-marketing-cream",
      accent: "text-marketing-accent",
    };
  }

  if (theme === "marketing") {
    return {
      muted: "text-marketing-charcoal/50",
      body: "text-marketing-charcoal",
      accent: "text-marketing-primary",
    };
  }

  return {
    muted: "text-muted-foreground",
    body: "text-foreground",
    accent: "text-primary",
  };
}

export function planPickerDialogChrome(className?: string) {
  return cn(
    "max-h-[92dvh] w-[calc(100vw-1.5rem)] overflow-y-auto",
    /* Override DialogContent default md:max-w-lg so three plan cards fit comfortably */
    "max-w-none md:!max-w-[min(96rem,calc(100vw-2rem))]",
    "border-border/60 bg-background p-4 sm:p-8",
    "data-[state=open]:duration-300 data-[state=closed]:duration-200",
    className,
  );
}
