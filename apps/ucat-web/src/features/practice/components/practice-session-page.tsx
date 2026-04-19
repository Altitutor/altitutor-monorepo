"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QuestionEnginePage } from "@/features/question-engine";
import type { QuestionStemWithQuestions } from "@/features/question-engine/model/types";
import { UcatLagProvider } from "@/features/question-engine/context/ucat-lag-context";
import {
  clearPracticeSession,
  getPracticeSession,
  type PracticeSessionData,
} from "@/features/practice/lib/session-storage";
import type { SetGeneratorInput } from "@/features/set-generator/model/types";

async function fetchNextStem(
  input: SetGeneratorInput,
  excludeStemIds: string[],
): Promise<QuestionStemWithQuestions[] | null> {
  const response = await fetch("/api/ucat/practice-stems/next", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input,
      excludeStemIds,
    }),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as {
    stem: QuestionStemWithQuestions | null;
  };
  return data.stem ? [data.stem] : null;
}

export function PracticeSessionPage() {
  const router = useRouter();
  const [session, setSession] = useState<
    PracticeSessionData | null | "loading"
  >("loading");

  useEffect(() => {
    const data = getPracticeSession();
    if (!data) {
      router.replace("/practice");
      return;
    }
    if (data.mode === "set" && (!data.stems || data.stems.length === 0)) {
      router.replace("/practice");
      return;
    }
    setSession(data);
  }, [router]);

  const handleDone = useCallback(() => {
    clearPracticeSession();
    router.replace("/practice");
  }, [router]);

  if (session === "loading") {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  if (session.mode === "unlimited") {
    return (
      <UcatLagProvider>
        <UnlimitedPracticeEngine
          sessionId={session.sessionId}
          filters={session.filters}
          timePerQuestionSeconds={session.timePerQuestionSeconds}
          onBack={handleDone}
        />
      </UcatLagProvider>
    );
  }

  return (
    <UcatLagProvider>
      <QuestionEnginePage
        mode="questionStem"
        sourceId="practice"
        questionStems={session.stems}
        practice
        practiceSessionId={session.sessionId}
        timePerQuestionSeconds={session.timePerQuestionSeconds}
        backHref="/practice"
        onBack={handleDone}
      />
    </UcatLagProvider>
  );
}

function UnlimitedPracticeEngine({
  sessionId,
  filters,
  timePerQuestionSeconds,
  onBack,
}: {
  sessionId: string;
  filters: SetGeneratorInput;
  timePerQuestionSeconds: number | null;
  onBack: () => void;
}) {
  const [stems, setStems] = useState<QuestionStemWithQuestions[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await fetchNextStem(filtersRef.current, []);
      if (cancelled) return;
      if (next?.length) {
        setStems(next);
      } else {
        setError("No question stems match these filters.");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleNeedMoreStems = useCallback(async (excludeStemIds: string[]) => {
    const next = await fetchNextStem(filtersRef.current, excludeStemIds);
    if (next?.length) {
      setStems((prev) => [...prev, ...next]);
      return next;
    }
    return null;
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (error || stems.length === 0) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 p-8">
        <p className="text-muted-foreground">
          {error ?? "No questions available."}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg bg-sidebar px-4 py-2 text-sm font-medium text-sidebar-foreground"
        >
          Back to practice
        </button>
      </div>
    );
  }

  return (
    <QuestionEnginePage
      mode="questionStem"
      sourceId="practice"
      questionStems={stems}
      practice
      practiceSessionId={sessionId}
      timePerQuestionSeconds={timePerQuestionSeconds}
      backHref="/practice"
      onBack={onBack}
      onNeedMoreStems={handleNeedMoreStems}
    />
  );
}
