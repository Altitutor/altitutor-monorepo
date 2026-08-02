"use client";

import React from "react";
import {
  Bug,
  CheckCircle2,
  Clock3,
  Gauge,
  LayoutPanelTop,
  LogOut,
  Square,
  XCircle,
} from "lucide-react";
import { Switch } from "@altitutor/ui";
import { Button } from "@/components/ui/button";
import { useExamExperience } from "@/features/exam-experience/context/exam-experience-context";
import { useActiveExamAttempt } from "@/features/exam-attempts/context/active-exam-attempt-context";
import { useUcatInterfacePreferences } from "@/features/interface-preferences/hooks/use-ucat-interface-preferences";
import { useUcatLag } from "@/features/question-engine/context/ucat-lag-context";
import type { ExamToolbarLayout } from "@/features/interface-preferences/model/types";
import { openUserFeedback } from "@/lib/sentry/open-user-feedback";
import { cn } from "@/lib/utils";

function formatDuration(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remainder = rounded % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function CompactMetric({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={title}
      className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold tabular-nums text-muted-foreground"
    >
      {children}
    </span>
  );
}

export function UcatExamToolbar({ layout }: { layout: ExamToolbarLayout }) {
  const detailed = layout === "detailed_right";
  const { title, practice, requestExit } = useExamExperience();
  const { active } = useActiveExamAttempt();
  const { enabled: lagEnabled, setEnabled: setLagEnabled } = useUcatLag();
  const { updatePreferences } = useUcatInterfacePreferences();

  const toggleLayout = () => {
    const next: ExamToolbarLayout = detailed ? "compact_top" : "detailed_right";
    void updatePreferences({ examToolbarLayout: next });
  };
  const reportBug = () =>
    openUserFeedback({
      attemptKind: active?.kind ?? "tutorial",
      attemptId: active?.attemptId ?? null,
      resourceId: active?.resourceId ?? null,
      title,
      currentQuestion: practice?.stats?.currentQuestionNumber ?? null,
      phase: practice?.stats?.timingPhase ?? null,
      toolbarLayout: layout,
      lagMode: lagEnabled,
    });

  if (!detailed) {
    return (
      <aside className="flex h-12 min-w-0 items-center gap-1 border-b bg-background px-3 pr-14 shadow-sm">
        <h1
          className="min-w-0 flex-1 truncate text-sm font-semibold"
          title={title}
        >
          {title}
        </h1>
        {practice ? (
          <>
            <CompactMetric
              title={`Session time ${formatDuration(practice.elapsedSeconds)}`}
            >
              <Clock3 className="h-4 w-4" />
              {formatDuration(practice.elapsedSeconds)}
            </CompactMetric>
            {practice.showAnswerStats ? (
              <CompactMetric
                title={`${practice.stats?.correctCount ?? 0} correct, ${practice.stats?.incorrectCount ?? 0} incorrect`}
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {practice.stats?.correctCount ?? 0}
                <XCircle className="ml-1 h-4 w-4 text-red-600" />
                {practice.stats?.incorrectCount ?? 0}
              </CompactMetric>
            ) : null}
          </>
        ) : null}
        {practice?.onFinishPractice ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={practice.onFinishPractice}
            title="Finish practice"
          >
            <Square className="h-4 w-4" />
            <span className="sr-only">Finish practice</span>
          </Button>
        ) : null}
        <Button
          variant={lagEnabled ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setLagEnabled(!lagEnabled)}
          title={lagEnabled ? "Disable lag mode" : "Enable lag mode"}
        >
          <Gauge className="h-4 w-4" />
          <span className="sr-only">Lag mode</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={requestExit}
          title="Exit session"
        >
          <LogOut className="h-4 w-4" />
          <span className="sr-only">Exit session</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void reportBug()}
          title="Report a bug"
        >
          <Bug className="h-4 w-4" />
          <span className="sr-only">Report a bug</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="hidden md:inline-flex"
          onClick={toggleLayout}
          title="Move toolbar to the right"
        >
          <LayoutPanelTop className="h-4 w-4" />
          <span className="sr-only">Move toolbar to the right</span>
        </Button>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-l bg-background p-4 shadow-sm">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Session
          </p>
          <h1 className="mt-1 text-base font-semibold leading-snug">{title}</h1>
        </div>
        {practice ? (
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Timing
            </p>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span>Session time</span>
              <span className="font-semibold tabular-nums">
                {formatDuration(practice.elapsedSeconds)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span>Current stem</span>
              <span className="font-semibold tabular-nums">
                {formatDuration(practice.stats?.stemTimeSeconds ?? 0)}
              </span>
            </div>
            {(practice.stats?.stemQuestionTimes.length ?? 0) > 1 ? (
              <dl className="space-y-1 border-l pl-3 text-xs text-muted-foreground">
                {practice.stats?.stemQuestionTimes.map((row) => (
                  <div
                    key={row.questionId}
                    className="flex items-center justify-between gap-2"
                  >
                    <dt>{row.label}</dt>
                    <dd className="font-medium tabular-nums text-foreground">
                      {formatDuration(row.seconds)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {practice.showAnswerStats ? (
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                {[
                  ["Answered", practice.stats?.answeredCount ?? 0],
                  ["Correct", practice.stats?.correctCount ?? 0],
                  ["Incorrect", practice.stats?.incorrectCount ?? 0],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-muted/60 p-2">
                    <div className="text-base font-semibold tabular-nums">
                      {value}
                    </div>
                    <div className="text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Controls
          </p>
          <div className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/60">
            <span className="inline-flex items-center gap-2 text-sm">
              <Gauge className="h-4 w-4" />
              Lag mode
            </span>
            <Switch
              aria-label="Lag mode"
              checked={lagEnabled}
              onCheckedChange={setLagEnabled}
            />
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={toggleLayout}
          >
            <LayoutPanelTop className="mr-2 h-4 w-4" />
            Move toolbar to top
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => void reportBug()}
          >
            <Bug className="mr-2 h-4 w-4" />
            Report a bug
          </Button>
        </div>
      </div>
      <div className={cn("space-y-2 border-t pt-4")}>
        {practice?.onFinishPractice ? (
          <Button className="w-full" onClick={practice.onFinishPractice}>
            <Square className="mr-2 h-4 w-4" />
            Finish practice
          </Button>
        ) : null}
        <Button variant="outline" className="w-full" onClick={requestExit}>
          <LogOut className="mr-2 h-4 w-4" />
          Exit session
        </Button>
      </div>
    </aside>
  );
}
