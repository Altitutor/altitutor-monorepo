"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Badge } from "@altitutor/ui";
import { UcatPageHeader } from "@/features/layout";
import { useComingSoon } from "@/features/layout/context/coming-soon-context";
import { AccessUpsellModal } from "@/features/ucat-access/components/access-upsell-modal";
import {
  getUpsellConfigForPath,
  hasAccessForPath,
  type RequiredUcatAccess,
} from "@/features/ucat-access/lib/route-access";
import { useUcatAccess } from "@/features/ucat-access/hooks/use-ucat-access";
import { dashboardCards } from "@/features/dashboard/config/dashboard-cards";
import { TodaySessionCard } from "@/features/dashboard/components/today-session-card";
import { ReviewHeatmapCard } from "@/features/progress/components/review-heatmap-card";
import { UcatHoverChevron } from "@/lib/ucat-hover-chevron";
import { ucatDashboardNavTileClassName } from "@/lib/ucat-surface-motion";

export function DashboardPage() {
  const reduceMotion = useReducedMotion();
  const { showComingSoonModal } = useComingSoon();
  const access = useUcatAccess();
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [upsellRequiredAccess, setUpsellRequiredAccess] =
    useState<RequiredUcatAccess | null>(null);

  const openUpsellForPath = (path: string) => {
    const config = getUpsellConfigForPath(path);
    if (!config) return;
    setUpsellRequiredAccess(config.requiredAccess);
    setUpsellOpen(true);
  };

  const cardGridVariants = useMemo(
    () => ({
      hidden: {},
      show: {
        transition: {
          staggerChildren: reduceMotion ? 0 : 0.04,
          delayChildren: reduceMotion ? 0 : 0.03,
        },
      },
    }),
    [reduceMotion],
  );

  const cardItemVariants = useMemo(
    () => ({
      hidden: reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 },
      show: {
        opacity: 1,
        y: 0,
        transition: {
          duration: reduceMotion ? 0 : 0.2,
          ease: [0.32, 0.72, 0, 1] as const,
        },
      },
    }),
    [reduceMotion],
  );

  const cardSurfaceClass = ucatDashboardNavTileClassName();

  return (
    <div className="space-y-6">
      <UcatPageHeader
        title="Dashboard"
        description="Quick access to your UCAT preparation tools"
      />

      {access.hasInPersonAccess ? <TodaySessionCard /> : null}
      {access.hasOnlineAccess ? (
        <ReviewHeatmapCard showViewAllProgressLink />
      ) : null}

      <motion.div
        className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3"
        variants={cardGridVariants}
        initial="hidden"
        animate="show"
      >
        {dashboardCards.map((card) => {
          const Icon = card.icon;
          const accessConfig = getUpsellConfigForPath(card.href);
          const blocked = !hasAccessForPath(card.href, access);

          if (card.comingSoon) {
            return (
              <motion.button
                key={card.href}
                type="button"
                variants={cardItemVariants}
                onClick={() => showComingSoonModal()}
                className={cardSurfaceClass}
                aria-label={`${card.label} (coming soon)`}
              >
                <div className="flex w-full items-start justify-between">
                  <div className="rounded-lg bg-muted/60 p-2.5 transition-colors duration-200 group-hover:bg-muted">
                    <Icon className="h-5 w-5 text-muted-foreground transition-colors duration-200 group-hover:text-foreground" />
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    Coming soon
                  </Badge>
                </div>
                <h3 className="mt-4 font-semibold">{card.label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {card.description}
                </p>
              </motion.button>
            );
          }

          if (blocked) {
            return (
              <motion.button
                key={card.href}
                type="button"
                variants={cardItemVariants}
                onClick={() => openUpsellForPath(card.href)}
                className={cardSurfaceClass}
              >
                <div className="flex w-full items-start justify-between">
                  <div className="rounded-lg bg-muted/60 p-2.5 transition-colors duration-200 group-hover:bg-muted">
                    <Icon className="h-5 w-5 text-muted-foreground transition-colors duration-200 group-hover:text-foreground" />
                  </div>
                  {accessConfig ? (
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {accessConfig.badgeLabel}
                    </Badge>
                  ) : null}
                </div>
                <h3 className="mt-4 font-semibold">{card.label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {card.description}
                </p>
              </motion.button>
            );
          }

          return (
            <motion.div
              key={card.href}
              variants={cardItemVariants}
              className="flex h-full min-w-0 flex-col"
            >
              <Link href={card.href} className={cardSurfaceClass}>
                <div className="flex w-full items-start justify-between">
                  <div className="rounded-lg bg-muted/60 p-2.5 transition-colors duration-200 group-hover:bg-muted">
                    <Icon className="h-5 w-5 text-muted-foreground transition-colors duration-200 group-hover:text-foreground" />
                  </div>
                  <UcatHoverChevron />
                </div>
                <h3 className="mt-4 font-semibold">{card.label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {card.description}
                </p>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>
      <AccessUpsellModal
        open={upsellOpen}
        requiredAccess={upsellRequiredAccess}
        onOpenChange={(open) => {
          setUpsellOpen(open);
          if (!open) setUpsellRequiredAccess(null);
        }}
      />
    </div>
  );
}
