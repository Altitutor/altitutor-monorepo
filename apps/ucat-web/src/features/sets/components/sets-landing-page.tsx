"use client";

import { motion } from "motion/react";
import { ListChecks, Sparkles } from "lucide-react";
import { UcatPageHeader } from "@/features/layout";
import { SECTION_NUMBER_TO_NAME } from "@/features/sets/lib/section-labels";
import { isSetGeneratorEnabled } from "@/lib/feature-flags";
import { UcatClickableCardLink } from "@/shared/components/ucat-clickable-card";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";

const SECTIONS = [1, 2, 3, 4] as const;

export function SetsLandingPage() {
  const setGeneratorEnabled = isSetGeneratorEnabled();
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
      {setGeneratorEnabled ? (
        <motion.section
          className="space-y-3"
          variants={itemVariants}
          initial="hidden"
          animate="show"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Create
          </h2>
          <UcatClickableCardLink
            href="/sets/set-generator"
            icon={Sparkles}
            title="Set Generator"
            description="Build a custom practice set from section, timing, and performance filters."
          />
        </motion.section>
      ) : null}
    </div>
  );
}
