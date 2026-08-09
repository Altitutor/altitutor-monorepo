"use client";

import { motion } from "motion/react";
import { BookOpen } from "lucide-react";
import { UcatPageHeader } from "@/features/layout";
import { SECTION_NUMBER_TO_NAME } from "@/features/sets/lib/section-labels";
import { UcatClickableCardLink } from "@/shared/components/ucat-clickable-card";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";

const SECTIONS = [1, 2, 3, 4] as const;

export function LearningCatalogPage() {
  const { containerVariants, itemVariants } = useUcatStaggerMotion();

  return (
    <div className="space-y-6">
      <div id="tour-learn-page">
        <UcatPageHeader
          title="Learn"
          description="Choose an area to find your next learning module."
        />
      </div>
      <motion.div
        data-tour="learn-options"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={itemVariants}>
          <UcatClickableCardLink
            href="/learn/general"
            icon={BookOpen}
            title="General"
          />
        </motion.div>
        {SECTIONS.map((sectionNumber) => (
          <motion.div key={sectionNumber} variants={itemVariants}>
            <UcatClickableCardLink
              href={`/learn/sections/${sectionNumber}`}
              icon={BookOpen}
              title={
                SECTION_NUMBER_TO_NAME[sectionNumber] ??
                `Section ${sectionNumber}`
              }
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
