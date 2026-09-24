"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  UcatExamActionButton,
  UcatExamShell,
} from "@altitutor/ui";
import {
  ArrowRight,
  Calculator,
  Flag,
  Lightbulb,
  Navigation,
} from "lucide-react";
import { UcatPageHeader } from "@/features/layout";
import { LearningLessonContentsSidebar } from "@/features/learning/components/learning-lesson-contents-sidebar";
import type { LearningModuleBlockRow } from "@/features/learning/types";
import { UCAT_CARD_CHROME } from "@/lib/ucat-surface-motion";
import { UpsellDialogProvider } from "@/features/ucat-access/context/upsell-dialog-context";

const previewBlocks: LearningModuleBlockRow[] = [
  {
    id: "preview-concept",
    block_type: "text",
    index: 0,
    content: {
      body: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "The evidence-only rule" }],
          },
        ],
      },
    },
    block_completed_at: "2026-07-22T00:00:00.000Z",
    require_completion_before_next: false,
    file_id: null,
    interaction_state: null,
    learning_module_id: "preview-learning-module",
    manually_completed: false,
    question_id: null,
    question_stem_id: null,
    skill_trainer_id: null,
  },
  {
    id: "preview-example",
    block_type: "text",
    index: 1,
    content: {
      body: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Worked example" }],
          },
        ],
      },
    },
    block_completed_at: "2026-07-22T00:00:00.000Z",
    require_completion_before_next: false,
    file_id: null,
    interaction_state: null,
    learning_module_id: "preview-learning-module",
    manually_completed: false,
    question_id: null,
    question_stem_id: null,
    skill_trainer_id: null,
  },
  {
    id: "preview-question",
    block_type: "question",
    index: 2,
    content: null,
    block_completed_at: null,
    require_completion_before_next: false,
    file_id: null,
    interaction_state: null,
    learning_module_id: "preview-learning-module",
    manually_completed: false,
    question_id: "preview-question",
    question_stem_id: "preview-question-stem",
    skill_trainer_id: null,
  },
];

const previewOptions = [
  "The cost of labour or parts exceeded the cost of a comparable new item",
  "No suitable replacement part could be obtained",
  "Technicians considered the items unsafe to repair",
  "The council would not pay for the initial assessment",
] as const;

export function LearningLessonPreviewPage() {
  const [activeIndex, setActiveIndex] = useState(2);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-6">
          <UcatPageHeader
            title="Drawing safe conclusions"
            description="Use only the evidence in the passage — not what seems likely in real life."
            backHref="/learn/sections/1"
            backLabel="All modules"
            breadcrumbItems={[
              { label: "Learn", href: "/learn" },
              { label: "Verbal Reasoning", href: "/learn/sections/1" },
              { label: "Reading Comprehension", href: "/learn/sections/1" },
              { label: "Drawing safe conclusions" },
            ]}
          />

          <Card className={UCAT_CARD_CHROME}>
            <CardContent className="space-y-4 pt-6 text-sm leading-relaxed">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">
                  The evidence-only rule
                </h2>
                <p className="mt-2 text-muted-foreground">
                  A conclusion is safe only when the passage gives you enough
                  evidence to support it. Do not choose an answer because it
                  sounds sensible; ask whether it must be true from what you
                  have been told.
                </p>
              </div>
              <div className="rounded-lg border-l-4 border-primary/35 bg-muted/60 p-4">
                <div className="flex items-center gap-2 font-medium">
                  <Lightbulb className="size-4 text-primary" aria-hidden />
                  Tutor note
                </div>
                <p className="mt-2 text-muted-foreground">
                  Words such as <strong>all</strong>, <strong>only</strong> and
                  <strong> always</strong> often turn a supported idea into an
                  unsupported claim.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight">
              Check your understanding
            </h2>
            <div className="overflow-hidden rounded-lg border bg-background">
              <div className="h-[500px]">
                <UcatExamShell
                  sectionTitle="Verbal Reasoning"
                  sectionTitleRight="Question 1 of 1"
                  toolLeft={
                    <span className="inline-flex items-center gap-1">
                      <Calculator className="size-4" aria-hidden />
                      <span className="text-[13pt]">
                        <span className="underline">C</span>alculator
                      </span>
                    </span>
                  }
                  toolRight={
                    <span className="inline-flex items-center gap-1">
                      <Flag className="size-4" aria-hidden />
                      <span className="text-[13pt]">
                        <span className="underline">F</span>lag for Review
                      </span>
                    </span>
                  }
                  footerRight={
                    <>
                      <UcatExamActionButton
                        icon={<Navigation className="size-4" />}
                      >
                        <span className="text-[14pt]">
                          Na<span className="underline">v</span>igator
                        </span>
                      </UcatExamActionButton>
                      <UcatExamActionButton
                        variant="highlight"
                        icon={<ArrowRight className="size-4" />}
                        iconRight
                      >
                        <span className="text-[14pt]">
                          <span className="underline">N</span>ext
                        </span>
                      </UcatExamActionButton>
                    </>
                  }
                >
                  <div className="flex h-full min-h-0 gap-4 font-[Arial] text-[11pt] leading-relaxed">
                    <article className="h-full min-w-0 flex-[3] overflow-y-auto border-r-[6px] border-[#2f608e] py-4 pr-4 sm:py-5">
                      <p>
                        In 2021, the coastal city of Bellhaven began a
                        three-year trial called Fix First. Residents could take
                        small household appliances to one of six repair hubs,
                        where technicians assessed whether an item could be
                        repaired, recycled or returned unchanged.
                      </p>
                      <p className="mt-3">
                        Of the items assessed, 46% were repaired during the
                        first appointment and a further 19% after a part was
                        ordered. In 21% of cases, repair was possible but
                        uneconomic because labour or parts cost more than a
                        comparable new item.
                      </p>
                    </article>
                    <section className="h-full min-w-0 flex-[2] overflow-y-auto py-4 pl-2 pr-1 sm:py-5">
                      <p className="font-medium text-[12pt]">
                        Why were some items possible to repair but not repaired?
                      </p>
                      <div className="mt-3 space-y-2 pl-0 sm:pl-6">
                        {previewOptions.map((option, index) => (
                          <label
                            key={option}
                            className="flex cursor-pointer items-start gap-2"
                          >
                            <input
                              type="radio"
                              name="learning-preview-question"
                              checked={selectedOption === index}
                              onChange={() => setSelectedOption(index)}
                              className="mt-1 size-4"
                            />
                            <span className="flex min-w-0">
                              <span className="inline-block w-6 shrink-0 sm:w-8">
                                {String.fromCharCode(65 + index)}.
                              </span>
                              <span className="ml-0 min-w-0 sm:ml-4">
                                {option}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </section>
                  </div>
                </UcatExamShell>
              </div>
            </div>
          </div>
        </div>

        <UpsellDialogProvider>
          <LearningLessonContentsSidebar
            blocks={previewBlocks}
            activeIndex={activeIndex}
            completionPercent={67}
            isLessonComplete={false}
            isBlockComplete={(block) => block.block_completed_at != null}
            onSelectBlock={setActiveIndex}
            onMarkBlockComplete={() => undefined}
            onRequestMarkComplete={() => undefined}
            onRequestMarkIncomplete={() => undefined}
            nextLesson={null}
          />
        </UpsellDialogProvider>
      </div>
    </div>
  );
}
