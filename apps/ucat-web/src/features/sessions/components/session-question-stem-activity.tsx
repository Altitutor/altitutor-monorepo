"use client";

import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, Play } from "lucide-react";
import { Skeleton } from "@altitutor/ui";
import { Button } from "@/components/ui/button";
import { useUcatInterfacePreferences } from "@/features/interface-preferences/hooks/use-ucat-interface-preferences";
import { fetchStemForPracticeSession } from "@/features/practice/lib/fetch-stem-for-practice";
import { QuestionEnginePage } from "@/features/question-engine/components/question-engine-page";
import { UcatLagProvider } from "@/features/question-engine/context/ucat-lag-context";
import type { QuestionStemWithQuestions } from "@/features/question-engine/model/types";
import { cn } from "@/lib/utils";

export function SessionQuestionStemActivity({
  resourceId,
  stemId,
  started,
  active,
  completed,
  onActivate,
  onComplete,
}: {
  resourceId: string;
  stemId: string;
  started: boolean;
  active: boolean;
  completed: boolean;
  onActivate: () => void;
  onComplete: () => void;
}) {
  const [stem, setStem] = useState<QuestionStemWithQuestions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { preferences, updatePreferences } = useUcatInterfacePreferences();

  useEffect(() => {
    if (!started || stem || error) return;
    let cancelled = false;
    void fetchStemForPracticeSession(stemId)
      .then((nextStem) => {
        if (!cancelled) setStem(nextStem);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load this question stem.");
      });
    return () => {
      cancelled = true;
    };
  }, [error, started, stem, stemId]);

  useEffect(() => {
    if (wrapperRef.current) wrapperRef.current.inert = started && !active;
    if (active) wrapperRef.current?.focus();
  }, [active, started]);

  return (
    <section className="relative overflow-hidden rounded-xl border bg-card shadow-sm">
      <div
        ref={wrapperRef}
        tabIndex={-1}
        aria-hidden={started && !active}
        className={cn(
          "min-h-[32rem] outline-none transition-[filter,opacity] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
          (!started || !active) &&
            "pointer-events-none select-none blur-[3px] opacity-55",
        )}
      >
        {!started ? (
          <div className="space-y-4 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          </div>
        ) : error ? (
          <p className="p-6 text-sm text-destructive">{error}</p>
        ) : stem ? (
          <UcatLagProvider
            enabled={preferences.lagModeEnabled}
            onEnabledChange={(enabled) => {
              void updatePreferences({ lagModeEnabled: enabled });
            }}
          >
            <QuestionEnginePage
              mode="questionStem"
              sourceId={`session-resource-${resourceId}`}
              questionStems={[stem]}
              practice
              reviewTiming="afterEachStem"
              confirmPracticeTransitions={false}
              timePerQuestionSeconds={null}
              onLearnProgress={onComplete}
              disableQuestionAttemptLogging
              embeddedInLesson
              embeddedInteractionActive={active}
            />
          </UcatLagProvider>
        ) : (
          <div className="space-y-3 p-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-72 w-full" />
          </div>
        )}
      </div>
      {!active ? (
        <div className="absolute inset-0 z-10 grid place-items-center bg-background/20 p-6 backdrop-blur-[1px]">
          <Button type="button" size="lg" onClick={onActivate}>
            {completed ? (
              <CheckCircle2 className="mr-2 h-5 w-5" />
            ) : (
              <Play className="mr-2 h-5 w-5" />
            )}
            {completed
              ? "Review question stem"
              : started
                ? "Continue question stem"
                : "Start question stem"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
