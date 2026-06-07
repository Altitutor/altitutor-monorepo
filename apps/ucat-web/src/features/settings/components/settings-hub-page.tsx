"use client";

import Link from "next/link";
import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ChevronRight, CreditCard, Monitor, Palette, User } from "lucide-react";
import { UcatPageHeader } from "@/features/layout";
import { UCAT_SURFACE_CARD, UCAT_SURFACE_MOTION } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

const LINKS = [
  {
    href: "/settings/app",
    label: "App settings",
    description: "Timezone, appearance, and guided tours.",
    icon: Palette,
  },
  {
    href: "/settings/profile",
    label: "My profile",
    description: "Email, your name, and password.",
    icon: User,
  },
  {
    href: "/settings/plan",
    label: "Plan",
    description: "Your plan, benefits, billing, and upgrade options.",
    icon: CreditCard,
  },
  {
    href: "/settings/study-planner",
    label: "Study planner",
    description: "Test date and per-section target scores.",
    icon: Monitor,
  },
] as const;

export function SettingsHubPage() {
  const reduceMotion = useReducedMotion();

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

  const cardSurfaceClass = cn(
    "group relative flex h-full w-full flex-col items-start rounded-ucatShell p-6 text-left",
    UCAT_SURFACE_CARD,
    UCAT_SURFACE_MOTION,
    !reduceMotion && "hover:-translate-y-0.5",
    "hover:bg-muted/40 hover:shadow-md hover:ring-black/[0.1] dark:hover:ring-white/[0.12]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-white/35",
  );

  return (
    <div className="space-y-6">
      <UcatPageHeader
        title="Settings"
        description="Choose what you want to manage."
      />

      <motion.div
        className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3"
        variants={cardGridVariants}
        initial="hidden"
        animate="show"
      >
        {LINKS.map((item) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.href}
              variants={cardItemVariants}
              className="flex h-full min-w-0 flex-col"
            >
              <Link href={item.href} className={cardSurfaceClass}>
                <div className="flex w-full items-start justify-between">
                  <div className="rounded-lg bg-muted/60 p-2.5 transition-colors duration-200 group-hover:bg-muted">
                    <Icon
                      className="h-5 w-5 text-muted-foreground transition-colors duration-200 group-hover:text-foreground"
                      aria-hidden
                    />
                  </div>
                  <ChevronRight
                    className={cn(
                      "h-5 w-5 shrink-0 text-muted-foreground opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:text-foreground",
                      !reduceMotion && "translate-x-0 group-hover:translate-x-0.5",
                    )}
                    aria-hidden
                  />
                </div>
                <h3 className="mt-4 font-semibold">{item.label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
