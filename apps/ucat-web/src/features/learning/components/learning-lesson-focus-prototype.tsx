"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@altitutor/ui";
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronLeft, ChevronRight, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UcatPageHeader } from "@/features/layout/components/ucat-page-header";
import { LearningLessonPreviewPage } from "./learning-lesson-preview-page";
import { cn } from "@/lib/utils";

const variants = [
  { key: "blur", label: "Graduated blur" },
  { key: "outline", label: "Guided outline" },
  { key: "slides", label: "One block at a time" },
] as const;

const blocks = [
  { label: "Read the method", type: "Concept" },
  { label: "Try the question", type: "Practice" },
  { label: "Worked solution", type: "Explanation" },
  { label: "Take it into the test", type: "Recap" },
];

const options = [
  "The labour or parts cost more than a comparable new item.",
  "A suitable replacement part was unavailable.",
  "Technicians decided the items were unsafe to repair.",
  "The council would not pay for the initial assessment.",
];

// DEV-143 throwaway UI prototype on the existing lesson preview route.
function LearningLessonFocusPrototype({ variantIndex }: { variantIndex: number }) {
  const currentVariant = variants[variantIndex];
  const [active, setActive] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pendingFocus = useRef(false);

  const slides = currentVariant.key === "slides";
  const blur = currentVariant.key === "blur";
  const mayOpen = (index: number) => index < 2 || submitted !== null;

  function goTo(index: number) {
    if (index === active || !blocks[index] || !mayOpen(index)) return;
    if (index === 2) setRevealed(true);
    pendingFocus.current = true;
    setActive(index);
  }

  useEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function checkAnswer() {
    if (selected === null) return;
    setSubmitted(selected);
    if (slides) {
      setRevealed(true);
      pendingFocus.current = true;
      setActive(2);
    }
  }

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

  function status(index: number) {
    if (!mayOpen(index)) return "After you answer";
    if (index === 1 && submitted !== null) return "Answered";
    if (index === 2 && revealed) return "Revealed";
    return index === active ? "In focus" : "Open block";
  }

  function navigationButton(index: number) {
    return (
      <button
        type="button"
        disabled={!mayOpen(index)}
        aria-current={index === active ? "step" : undefined}
        onClick={() => goTo(index)}
        className={cn(
          "relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm",
          "enabled:cursor-pointer enabled:hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary",
          index === active && "bg-primary/10 font-semibold text-primary",
          !mayOpen(index) && "text-muted-foreground",
        )}
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-full border bg-background text-xs tabular-nums" aria-hidden>
          {index + 1}
        </span>
        <span className="min-w-0 flex-1">{blocks[index].label}</span>
        {!mayOpen(index) ? <LockKeyhole className="size-3.5 shrink-0" aria-hidden /> : null}
        <span className={cn("shrink-0 text-xs text-muted-foreground", mayOpen(index) ? "sr-only" : "sr-only sm:not-sr-only")}>
          {status(index)}
        </span>
      </button>
    );
  }

  const activeBlock = (
    <Card className="gap-0 border-primary/25 bg-background py-0 shadow-sm">
      <CardContent className="space-y-5 p-5 sm:p-7">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 text-xs font-medium text-muted-foreground">
            <span className="font-semibold text-primary">{blocks[active].type}</span>
            <span aria-hidden>·</span>
            <span>Block {active + 1} of {blocks.length}</span>
          </div>
          <h2 ref={headingRef} tabIndex={-1} className="scroll-mt-8 text-xl font-semibold tracking-tight outline-none sm:text-2xl">
            {blocks[active].label}
          </h2>
        </div>

        {active === 0 && (
          <div className="space-y-3 text-sm leading-relaxed">
            <p>A conclusion is safe when you can point to the words in the passage that support it.</p>
            <p className="rounded-lg border-l-4 border-primary/30 bg-muted/65 p-4">
              <strong>Tutor tip.</strong> Watch for words like <em>all</em>, <em>only</em> and <em>always</em>. They can make an answer more definite than the passage allows.
            </p>
          </div>
        )}

        {active === 1 && (
          <div className="grid gap-5 text-sm leading-relaxed md:grid-cols-2">
            <div className="space-y-3 rounded-lg bg-muted/60 p-4">
              <h3 className="font-semibold">Passage</h3>
              <p>The city of Bellhaven started a repair trial called Fix First. Residents could take small appliances to one of six repair hubs for assessment.</p>
              <p>Of the items assessed, 46% were repaired at the first appointment and 19% after a part was ordered. In 21% of cases, repairs were possible but labour or parts cost more than buying a comparable new item.</p>
            </div>
            <div className="space-y-3">
              <fieldset disabled={submitted !== null} className="min-w-0 space-y-2">
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
              {submitted === null ? (
                <Button type="button" disabled={selected === null} onClick={checkAnswer}>
                  {slides ? "Submit and see solution" : "Check answer"}
                </Button>
              ) : (
                <div role="status" className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Check className="size-4 text-primary" aria-hidden />
                  Answer submitted
                </div>
              )}
            </div>
          </div>
        )}

        {active === 2 && submitted !== null && (
          <div className="space-y-3 text-sm leading-relaxed">
            <p className="font-medium">{submitted === 0 ? "Correct" : "The correct answer is A"}</p>
            <p className="rounded-lg bg-primary/10 p-4 font-medium">{options[0]}</p>
            <p>The passage gives a direct cost comparison. A new item cost less than the labour or parts needed for repair. The passage gives no evidence that these items were unsafe or that parts were unavailable.</p>
          </div>
        )}

        {active === 3 && (
          <p className="text-sm leading-relaxed">For your next question, underline the sentence that supports your answer before reading the other options. If you can&apos;t point to the evidence, reconsider.</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          <Button type="button" variant="outline" size="sm" disabled={active === 0} onClick={() => goTo(active - 1)}>
            <ArrowLeft className="size-4" aria-hidden />
            Previous block
          </Button>
          {active < blocks.length - 1 ? (
            <Button
              type="button"
              variant={active === 1 && submitted !== null ? "default" : "outline"}
              size="sm"
              disabled={!mayOpen(active + 1)}
              onClick={() => goTo(active + 1)}
            >
              {active === 1 ? (revealed ? "Review solution" : "Reveal solution") : "Next block"}
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          ) : (
            <span className="text-xs font-medium text-muted-foreground">End of sample lesson</span>
          )}
        </div>
      </CardContent>
    </Card>
  );

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
              setActive(1);
              setSelected(null);
              setSubmitted(null);
              setRevealed(false);
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

      {blur ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_15rem]">
          <div className="space-y-3">
            {blocks.map((block, index) => {
              if (index === active) return <div key={block.label}>{activeBlock}</div>;
              const distance = Math.abs(index - active);
              return (
                <div key={block.label} className="relative isolate overflow-hidden rounded-xl border bg-background/75">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 right-3 -z-10 flex w-2/5 flex-col justify-center gap-1.5"
                    style={{
                      filter: `blur(${distance === 1 ? 2 : distance === 2 ? 5 : 8}px)`,
                      opacity: distance === 1 ? 0.6 : 0.4,
                    }}
                  >
                    <span className="h-1.5 w-5/6 rounded-full bg-muted-foreground/35" />
                    <span className="h-1.5 w-full rounded-full bg-muted-foreground/30" />
                    <span className="h-1.5 w-2/3 rounded-full bg-muted-foreground/25" />
                  </div>
                  <div className="mr-[34%] bg-gradient-to-r from-background to-background/80">
                    {navigationButton(index)}
                  </div>
                </div>
              );
            })}
          </div>
          <aside className="hidden h-fit rounded-xl border bg-background p-3 lg:block">
            <h2 className="mb-1 px-3 text-xs font-semibold text-muted-foreground">On this page</h2>
            <nav aria-label="Lesson blocks">{blocks.map((block, index) => <div key={block.label}>{navigationButton(index)}</div>)}</nav>
          </aside>
        </div>
      ) : slides ? (
        <div className="mx-auto max-w-5xl space-y-3">
          <div aria-hidden className="grid grid-cols-4 gap-1.5">
            {blocks.map((block, index) => (
              <div key={block.label} className={cn("h-1.5 rounded-full", index === active ? "bg-primary" : "bg-primary/20")} />
            ))}
          </div>
          {activeBlock}
        </div>
      ) : (
        <div className="mx-auto max-w-5xl rounded-xl border bg-background">
          {blocks.map((block, index) => (
            <div key={block.label} className="border-b p-2 last:border-b-0 sm:p-3">
              {index === active ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-2 text-xs font-medium text-primary">
                    <ChevronDown className="size-4" aria-hidden />
                    In focus
                  </div>
                  {activeBlock}
                </div>
              ) : navigationButton(index)}
            </div>
          ))}
        </div>
      )}

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
            <div className="text-xs font-semibold">{currentVariant.label}</div>
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

  return variantIndex === -1 ? (
    <LearningLessonPreviewPage />
  ) : (
    <LearningLessonFocusPrototype variantIndex={variantIndex} />
  );
}
