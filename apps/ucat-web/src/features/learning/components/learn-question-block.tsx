"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Play, RotateCcw } from "lucide-react";
import { Skeleton } from "@altitutor/ui";
import { Button } from "@/components/ui/button";
import { QuestionEnginePage } from "@/features/question-engine/components/question-engine-page";
import type {
  QuestionEngineQuestion,
  QuestionStemWithQuestions,
} from "@/features/question-engine/model/types";
import { UcatLagProvider } from "@/features/question-engine/context/ucat-lag-context";
import { fetchStemForPracticeSession } from "@/features/practice/lib/fetch-stem-for-practice";
import { fetchQuestionForLearn } from "@/features/learning/lib/fetch-question-for-learn";
import type { LearningModuleBlockRow } from "@/features/learning/types";
import { cn } from "@/lib/utils";

type LearnQuestionBlockProps = {
  block: LearningModuleBlockRow;
  onProgressChange?: () => void;
  started: boolean;
  active: boolean;
  completed: boolean;
  onActivate: () => void;
};

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "stem"; stem: QuestionStemWithQuestions }
  | { status: "question"; question: QuestionEngineQuestion };

export function LearnQuestionBlock({
  block,
  onProgressChange,
  started,
  active,
  completed,
  onActivate,
}: LearnQuestionBlockProps) {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [resetVersion, setResetVersion] = useState(0);
  const engineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!started) return;
    let cancelled = false;

    async function load() {
      try {
        if (block.block_type === "question_stem" && block.question_stem_id) {
          const stem = await fetchStemForPracticeSession(
            block.question_stem_id,
          );
          if (!cancelled) setLoadState({ status: "stem", stem });
          return;
        }
        if (block.block_type === "question" && block.question_id && block.id) {
          const question = await fetchQuestionForLearn(
            block.question_id,
            block.id,
          );
          if (!cancelled) setLoadState({ status: "question", question });
          return;
        }
        if (!cancelled) setLoadState({ status: "error" });
      } catch {
        if (!cancelled) setLoadState({ status: "error" });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [
    block.block_type,
    block.question_stem_id,
    block.question_id,
    block.id,
    started,
  ]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.inert = !active;
    if (active) engineRef.current?.focus();
  }, [active]);

  if (!started) {
    return (
      <div className="relative min-h-72 overflow-hidden rounded-lg border">
        <div className="space-y-3 p-5 blur-[3px] opacity-55" aria-hidden>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
        <div className="absolute inset-0 grid place-items-center bg-background/20 backdrop-blur-[1px]">
          <Button type="button" onClick={onActivate}>
            <Play className="mr-2 h-4 w-4" />
            Start question stem
          </Button>
        </div>
      </div>
    );
  }

  if (loadState.status === "loading") {
    return (
      <div
        className="space-y-3"
        aria-busy="true"
        aria-label="Loading questions"
      >
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (loadState.status === "error") {
    return (
      <p className="text-sm text-destructive">
        Could not load questions for this block.
      </p>
    );
  }

  return (
    <div className="relative space-y-3 overflow-hidden rounded-lg">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setResetVersion((version) => version + 1)}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset
        </Button>
      </div>
      <div
        ref={engineRef}
        tabIndex={-1}
        aria-hidden={!active}
        className={cn(
          "rounded-lg border outline-none transition-[filter,opacity] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
          !active && "pointer-events-none select-none blur-[3px] opacity-55",
        )}
      >
        <UcatLagProvider>
          {loadState.status === "stem" ? (
            <QuestionEnginePage
              key={`stem-${block.id}-${resetVersion}`}
              mode="questionStem"
              sourceId={`learn-block-${block.id}`}
              questionStems={[loadState.stem]}
              practice
              reviewTiming="afterEachStem"
              confirmPracticeTransitions={false}
              timePerQuestionSeconds={null}
              learningModuleBlockId={block.id ?? undefined}
              onLearnProgress={onProgressChange}
              disableQuestionAttemptLogging
              embeddedInLesson
              embeddedInteractionActive={active}
            />
          ) : (
            <QuestionEnginePage
              key={`question-${block.id}-${resetVersion}`}
              mode="questions"
              sourceId={`learn-block-${block.id}`}
              standaloneQuestions={[loadState.question]}
              practice
              reviewTiming="afterEachStem"
              confirmPracticeTransitions={false}
              timePerQuestionSeconds={null}
              learningModuleBlockId={block.id ?? undefined}
              onLearnProgress={onProgressChange}
              disableQuestionAttemptLogging
              embeddedInLesson
              embeddedInteractionActive={active}
            />
          )}
        </UcatLagProvider>
      </div>
      {!active ? (
        <div className="absolute inset-0 grid place-items-center bg-background/20 backdrop-blur-[1px]">
          <Button type="button" onClick={onActivate}>
            {completed ? (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            {completed ? "Review question stem" : "Continue question stem"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
