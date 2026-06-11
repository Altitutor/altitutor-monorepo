"use client";

import { useEffect, useState } from "react";
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
};

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "stem"; stem: QuestionStemWithQuestions }
  | { status: "question"; question: QuestionEngineQuestion };

export function LearnQuestionBlock({ block, onProgressChange }: LearnQuestionBlockProps) {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (block.block_type === "question_stem" && block.question_stem_id) {
          const stem = await fetchStemForPracticeSession(block.question_stem_id);
          if (!cancelled) setLoadState({ status: "stem", stem });
          return;
        }
        if (block.block_type === "question" && block.question_id && block.id) {
          const question = await fetchQuestionForLearn(block.question_id, block.id);
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
  }, [block.block_type, block.question_stem_id, block.question_id, block.id]);

  if (loadState.status === "loading") {
    return <p className="text-sm text-muted-foreground">Loading questions…</p>;
  }

  if (loadState.status === "error") {
    return <p className="text-sm text-destructive">Could not load questions for this block.</p>;
  }

  return (
    <div
      className={cn(
        "h-[min(70vh,640px)] min-h-[420px] overflow-hidden rounded-lg border",
      )}
    >
      <UcatLagProvider>
        {loadState.status === "stem" ? (
          <QuestionEnginePage
            mode="questionStem"
            sourceId={`learn-block-${block.id}`}
            questionStems={[loadState.stem]}
            practice
            confirmPracticeTransitions={false}
            timePerQuestionSeconds={null}
            learningModuleBlockId={block.id ?? undefined}
            onLearnProgress={onProgressChange}
            embeddedInLesson
          />
        ) : (
          <QuestionEnginePage
            mode="questions"
            sourceId={`learn-block-${block.id}`}
            standaloneQuestions={[loadState.question]}
            practice
            confirmPracticeTransitions={false}
            timePerQuestionSeconds={null}
            learningModuleBlockId={block.id ?? undefined}
            onLearnProgress={onProgressChange}
            embeddedInLesson
          />
        )}
      </UcatLagProvider>
    </div>
  );
}
