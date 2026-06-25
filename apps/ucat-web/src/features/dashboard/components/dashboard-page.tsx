"use client";

import { motion } from "motion/react";
import { Badge } from "@altitutor/ui";
import { UcatPageHeader } from "@/features/layout";
import { useComingSoon } from "@/features/layout/context/coming-soon-context";
import { useUpsellDialog } from "@/features/ucat-access/context/upsell-dialog-context";
import {
  getUpsellConfigForPath,
  hasAccessForPath,
} from "@/features/ucat-access/lib/route-access";
import { useUcatAccess } from "@/features/ucat-access/hooks/use-ucat-access";
import { dashboardCards } from "@/features/dashboard/config/dashboard-cards";
import { DashboardFreeQuotaCard } from "@/features/dashboard/components/dashboard-free-quota-card";
import { DashboardPracticeDiscountCard } from "@/features/dashboard/components/dashboard-practice-discount-card";
import { TodaySessionCard } from "@/features/dashboard/components/today-session-card";
import { ReviewHeatmapCard } from "@/features/progress/components/review-heatmap-card";
import {
  UcatClickableCardButton,
  UcatClickableCardLink,
} from "@/shared/components/ucat-clickable-card";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";

export function DashboardPage() {
  const { containerVariants, itemVariants } = useUcatStaggerMotion();
  const { showComingSoonModal } = useComingSoon();
  const access = useUcatAccess();
  const { openInPersonUpsell } = useUpsellDialog();

  const openUpsellForPath = (path: string) => {
    const config = getUpsellConfigForPath(path);
    if (!config || config.requiredAccess !== "inPerson") return;
    openInPersonUpsell();
  };

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
      <DashboardFreeQuotaCard />
      <DashboardPracticeDiscountCard />

      <motion.div
        className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {dashboardCards.map((card) => {
          const accessConfig = getUpsellConfigForPath(card.href);
          const blocked = !hasAccessForPath(card.href, access);

          if (card.comingSoon) {
            return (
              <motion.div
                key={card.href}
                variants={itemVariants}
                className="flex h-full min-w-0 flex-col"
              >
                <UcatClickableCardButton
                  onClick={() => showComingSoonModal()}
                  aria-label={`${card.label} (coming soon)`}
                  icon={card.icon}
                  title={card.label}
                  description={card.description}
                  showChevron={false}
                  trailing={
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      Coming soon
                    </Badge>
                  }
                />
              </motion.div>
            );
          }

          if (blocked) {
            return (
              <motion.div
                key={card.href}
                variants={itemVariants}
                className="flex h-full min-w-0 flex-col"
              >
                <UcatClickableCardButton
                  onClick={() => openUpsellForPath(card.href)}
                  icon={card.icon}
                  title={card.label}
                  description={card.description}
                  showChevron={false}
                  trailing={
                    accessConfig ? (
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        {accessConfig.badgeLabel}
                      </Badge>
                    ) : null
                  }
                />
              </motion.div>
            );
          }

          return (
            <motion.div
              key={card.href}
              variants={itemVariants}
              className="flex h-full min-w-0 flex-col"
            >
              <UcatClickableCardLink
                href={card.href}
                icon={card.icon}
                title={card.label}
                description={card.description}
              />
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
