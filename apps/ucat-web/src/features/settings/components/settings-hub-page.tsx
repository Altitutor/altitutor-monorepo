"use client";

import { motion } from "motion/react";
import { CalendarClock, CreditCard, Mail, Palette, User } from "lucide-react";
import { UcatPageHeader } from "@/features/layout";
import { UcatClickableCardLink } from "@/shared/components/ucat-clickable-card";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";

const LINKS = [
  {
    href: "/settings/communications",
    label: "Email preferences",
    description: "Progress guidance, tips, news, and offers.",
    icon: Mail,
  },
  {
    href: "/settings/app",
    label: "App settings",
    description: "Timezone, appearance, and guided tours.",
    icon: Palette,
  },
  {
    href: "/settings/profile",
    label: "My profile",
    description: "Email, your name, password, and sign-in methods.",
    icon: User,
  },
  {
    href: "/settings/study-plan",
    label: "Study plan",
    description: "Target, test date, and weekly availability.",
    icon: CalendarClock,
  },
  {
    href: "/settings/plan",
    label: "Plan",
    description: "Your plan, billing, referrals, and upgrade options.",
    icon: CreditCard,
  },
] as const;

export function SettingsHubPage() {
  const { containerVariants, itemVariants } = useUcatStaggerMotion();

  return (
    <div className="space-y-6">
      <UcatPageHeader
        title="Settings"
        description="Choose what you want to manage."
      />

      <motion.div
        className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {LINKS.map((item) => (
          <motion.div
            key={item.href}
            variants={itemVariants}
            className="flex h-full min-w-0 flex-col"
          >
            <UcatClickableCardLink
              href={item.href}
              icon={item.icon}
              title={item.label}
              description={item.description}
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
