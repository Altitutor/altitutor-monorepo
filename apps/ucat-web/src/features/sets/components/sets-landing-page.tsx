"use client";

import { motion } from "motion/react";
import { ListChecks } from "lucide-react";
import { UcatPageHeader } from "@/features/layout";
import { SECTION_NUMBER_TO_NAME } from "@/features/sets/lib/section-labels";
import { UcatClickableCardLink } from "@/shared/components/ucat-clickable-card";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";

const SECTIONS = [1, 2, 3, 4] as const;

export function SetsLandingPage() {
  const { containerVariants, itemVariants } = useUcatStaggerMotion();

  return (
    <div className="space-y-6">
      <UcatPageHeader
        title="Sets"
        description="Choose a section to browse and practice question sets."
      />
      <motion.div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {SECTIONS.map((num) => {
          const label = SECTION_NUMBER_TO_NAME[num] ?? `Section ${num}`;
          return (
            <motion.div key={num} variants={itemVariants}>
              <UcatClickableCardLink
                href={`/sets/sections/${num}`}
                icon={ListChecks}
                title={label}
              />
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
