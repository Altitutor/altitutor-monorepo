import { ListChecks, Sparkles } from "lucide-react";
import { UcatPageHeader } from "@/features/layout";
import { SECTION_NUMBER_TO_NAME } from "@/features/sets/lib/section-labels";
import { isSetGeneratorEnabled } from "@/lib/feature-flags";
import { UcatClickableCardLink } from "@/shared/components/ucat-clickable-card";

const SECTIONS = [1, 2, 3, 4] as const;

export function SetsLandingPage() {
  const setGeneratorEnabled = isSetGeneratorEnabled();

  return (
    <div className="space-y-6">
      <UcatPageHeader
        title="Sets"
        description="Choose a section to browse and practice question sets."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SECTIONS.map((num) => {
          const label = SECTION_NUMBER_TO_NAME[num] ?? `Section ${num}`;
          return (
            <UcatClickableCardLink
              key={num}
              href={`/sets/sections/${num}`}
              icon={ListChecks}
              title={label}
            />
          );
        })}
      </div>
      {setGeneratorEnabled ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Create
          </h2>
          <UcatClickableCardLink
            href="/sets/set-generator"
            icon={Sparkles}
            title="Set Generator"
            description="Build a custom practice set from section, timing, and performance filters."
          />
        </section>
      ) : null}
    </div>
  );
}
