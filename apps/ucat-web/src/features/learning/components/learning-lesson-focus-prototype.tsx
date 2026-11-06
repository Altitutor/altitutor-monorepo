"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@altitutor/ui";
import { Check, ChevronLeft, ChevronRight, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UcatPageHeader } from "@/features/layout/components/ucat-page-header";
import { cn } from "@/lib/utils";
import { LearningWorkedSolution } from "./learning-worked-solution";
import { LearningLessonPreviewPage } from "./learning-lesson-preview-page";

const variants = [
  { key: "blurred-solution", label: "Blur the worked solution" },
  { key: "hidden", label: "Hide until answered" },
] as const;

const options = [
  "The labour or parts cost more than a comparable new item.",
  "A suitable replacement part was unavailable.",
  "Technicians decided the items were unsafe to repair.",
  "The council would not pay for the initial assessment.",
];

function LessonBlock({
  id,
  title,
  type,
  children,
}: {
  id: string;
  title: string;
  type: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-5">
      <Card className="gap-0 py-0">
        <CardContent className="space-y-3 p-5 text-sm leading-relaxed sm:p-6">
          <header className="space-y-1">
            <p className="text-xs font-semibold text-primary">{type}</p>
            <h2 id={`${id}-heading`} className="text-lg font-semibold tracking-tight sm:text-xl">
              {title}
            </h2>
          </header>
          {children}
        </CardContent>
      </Card>
    </section>
  );
}

// DEV-143 throwaway preview. Only the authored solution depends on submission.
function LearningLessonFocusPrototype({ variantIndex }: { variantIndex: number }) {
  const variant = variants[variantIndex];
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState<number | null>(null);
  const answered = submitted !== null;
  const showBlurredSolution = variant.key === "blurred-solution";

  const changeVariant = useCallback((direction: number) => {
    const next = variants[(variantIndex + direction + variants.length) % variants.length];
    window.history.replaceState(null, "", `?variant=${next.key}`);
  }, [variantIndex]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
        (event.key !== "ArrowLeft" && event.key !== "ArrowRight") ||
        (event.target instanceof HTMLElement &&
          event.target.closest("input, textarea, select, [contenteditable], [role=radio]"))
      ) return;
      event.preventDefault();
      changeVariant(event.key === "ArrowLeft" ? -1 : 1);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [changeVariant]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 pb-24">
      <UcatPageHeader
        title="Drawing safe conclusions"
        description="Use evidence from the passage to choose an answer."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSelected(null);
              setSubmitted(null);
            }}
          >
            Restart sample
          </Button>
        }
        breadcrumbItems={[
          { label: "Learn" },
          { label: "Verbal Reasoning" },
          { label: "Drawing safe conclusions" },
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="min-w-0 space-y-4">
          <LessonBlock id="method" type="Concept" title="Read the method">
            <p>A conclusion is safe when you can point to the words in the passage that support it.</p>
            <p className="text-muted-foreground">
              Watch for words like <em>all</em>, <em>only</em> and <em>always</em>. They can make an answer more definite than the passage allows.
            </p>
          </LessonBlock>

          <LessonBlock id="practice" type="Practice" title="Try the question">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-3 self-start rounded-lg bg-muted/60 p-4">
                <h3 className="font-semibold">Passage</h3>
                <p>The city of Bellhaven started a repair trial called Fix First. Residents could take small appliances to one of six repair hubs for assessment.</p>
                <p>Of the items assessed, 46% were repaired at the first appointment and 19% after a part was ordered. In 21% of cases, repairs were possible but labour or parts cost more than buying a comparable new item.</p>
              </div>
              <form
                className="min-w-0 space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!answered && selected !== null) setSubmitted(selected);
                }}
              >
                <fieldset disabled={answered} className="min-w-0 space-y-2">
                  <legend className="mb-3 font-medium">Why were some items possible to repair but left unrepaired?</legend>
                  {options.map((option, index) => (
                    <label
                      key={option}
                      className={cn(
                        "flex items-start gap-2.5 rounded-lg border p-3 has-[:enabled]:cursor-pointer has-[:enabled]:hover:bg-muted",
                        selected === index && "border-primary/45 bg-primary/10",
                      )}
                    >
                      <input
                        type="radio"
                        name="focus-preview-answer"
                        className="mt-1 size-4 shrink-0 accent-primary"
                        checked={selected === index}
                        onChange={() => setSelected(index)}
                      />
                      <span>{String.fromCharCode(65 + index)}. {option}</span>
                    </label>
                  ))}
                </fieldset>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Button
                    type="submit"
                    variant={answered ? "outline" : "default"}
                    disabled={selected === null}
                    aria-disabled={answered || undefined}
                    className={cn("min-w-40 shrink-0", answered && "cursor-default")}
                  >
                    {answered ? <Check className="size-4" aria-hidden /> : null}
                    {answered ? "Answer submitted" : "Submit answer"}
                  </Button>
                  <span role="status" className="sr-only">
                    {answered ? "Worked solution available below." : null}
                  </span>
                </div>
              </form>
            </div>
          </LessonBlock>

          {answered || showBlurredSolution ? (
            <LearningWorkedSolution locked={!answered}>
              <LessonBlock id="solution" type="Explanation" title="Worked solution">
                <p className="rounded-lg bg-primary/10 p-3">
                  <strong>Correct answer: A</strong>
                  <span className="mt-1 block">{options[0]}</span>
                </p>
                <p>The passage gives a direct cost comparison. A new item cost less than the labour or parts needed for repair. The passage gives no evidence that these items were unsafe or that parts were unavailable.</p>
              </LessonBlock>
            </LearningWorkedSolution>
          ) : null}

          <LessonBlock id="recap" type="Recap" title="Take it into the test">
            <p>On your next question, underline the sentence that supports your answer before reading the other options.</p>
          </LessonBlock>
        </div>

        <aside className="sticky top-5 hidden h-fit rounded-xl border bg-background p-4 lg:block">
          <nav aria-label="Lesson contents" className="space-y-3 text-sm">
            <h2 className="font-semibold">On this page</h2>
            <ul className="space-y-2 text-muted-foreground">
              <li><a className="hover:text-foreground hover:underline" href="#method">Read the method</a></li>
              <li><a className="hover:text-foreground hover:underline" href="#practice">Try the question</a></li>
              {answered ? (
                <li><a className="hover:text-foreground hover:underline" href="#solution">Worked solution</a></li>
              ) : showBlurredSolution ? (
                <li className="flex items-center gap-1.5">
                  <LockKeyhole className="size-3.5" aria-hidden />
                  <span>Worked solution <span className="sr-only">available after submitting</span></span>
                </li>
              ) : null}
              <li><a className="hover:text-foreground hover:underline" href="#recap">Take it into the test</a></li>
            </ul>
          </nav>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-3">
        <div className="flex items-center gap-1 rounded-full bg-slate-950 px-1 py-1 text-white shadow-lg">
          <button
            type="button"
            aria-label="Previous prototype"
            onClick={() => changeVariant(-1)}
            className="grid size-10 cursor-pointer place-items-center rounded-full hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <div className="min-w-0 px-1.5 text-center" aria-live="polite">
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-300">Prototype {variantIndex + 1} of {variants.length}</div>
            <div className="text-xs font-semibold">{variant.label}</div>
          </div>
          <button
            type="button"
            aria-label="Next prototype"
            onClick={() => changeVariant(1)}
            className="grid size-10 cursor-pointer place-items-center rounded-full hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

export function LearningLessonFocusPreview() {
  const variant = useSearchParams().get("variant");
  const variantIndex = variants.findIndex((item) => item.key === variant);

  // Keep the previous review links usable after replacing the old prototypes.
  if (variant === "locked-note" || variant === "blur" || variant === "outline" || variant === "slides") {
    return <LearningLessonFocusPrototype variantIndex={0} />;
  }
  return variantIndex === -1 ? (
    <LearningLessonPreviewPage />
  ) : (
    <LearningLessonFocusPrototype variantIndex={variantIndex} />
  );
}
