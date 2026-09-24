"use client";

import React from "react";
import {
  Bug,
  CheckCircle2,
  Clock3,
  Gauge,
  LayoutPanelTop,
  LogOut,
  MessageSquareMore,
  Square,
  XCircle,
} from "lucide-react";
import {
  Switch,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@altitutor/ui";
import { Button } from "@/components/ui/button";
import { useExamExperience } from "@/features/exam-experience/context/exam-experience-context";
import { useActiveExamAttempt } from "@/features/exam-attempts/context/active-exam-attempt-context";
import { useUcatInterfacePreferences } from "@/features/interface-preferences/hooks/use-ucat-interface-preferences";
import { useUcatLag } from "@/features/question-engine/context/ucat-lag-context";
import type { ExamToolbarLayout } from "@/features/interface-preferences/model/types";
import { openUserFeedback } from "@/lib/sentry/open-user-feedback";
import { useMediaQuery } from "@/shared/hooks/use-media-query";
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
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex h-8 cursor-help items-center gap-1 rounded-md px-2 text-xs font-semibold tabular-nums text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{title}</TooltipContent>
    </Tooltip>
  );
}

function CompactToolbarTitle({ title }: { title: string }) {
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const [truncated, setTruncated] = React.useState(false);

  React.useEffect(() => {
    const heading = headingRef.current;
    if (!heading) return;

    const updateTruncation = () => {
      setTruncated(heading.scrollWidth > heading.clientWidth);
    };
    updateTruncation();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateTruncation);
      return () => window.removeEventListener("resize", updateTruncation);
    }

    const observer = new ResizeObserver(updateTruncation);
    observer.observe(heading);
    return () => observer.disconnect();
  }, [title]);

  const heading = (
    <h1
      ref={headingRef}
      className="min-w-12 flex-1 truncate text-sm font-semibold"
    >
      {title}
    </h1>
  );

  return truncated ? (
    <Tooltip>
      <TooltipTrigger asChild>{heading}</TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-sm">
        {title}
      </TooltipContent>
    </Tooltip>
  ) : (
    heading
  );
}

function CompactAction({
  label,
  tooltip,
  icon,
  onClick,
  filled = false,
  destructive = false,
  showLabel,
  className,
  tourTarget,
}: {
  label: string;
  tooltip?: string;
  icon: React.ReactNode;
  onClick: () => void;
  filled?: boolean;
  destructive?: boolean;
  showLabel: boolean;
  className?: string;
  tourTarget?: string;
}) {
  const accessibleLabel = tooltip ?? label;
  const button = (
    <Button
      data-tour={tourTarget}
      variant={destructive ? "destructive" : filled ? "default" : "ghost"}
      size="sm"
      aria-label={accessibleLabel}
      className={cn(
        "group gap-1.5 transition-colors",
        !destructive && !filled && "hover:!bg-muted hover:!text-foreground",
        className,
      )}
      onClick={onClick}
    >
      {icon}
      {showLabel ? <span>{label}</span> : null}
    </Button>
  );

  return showLabel ? (
    button
  ) : (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="bottom">{accessibleLabel}</TooltipContent>
    </Tooltip>
  );
}

function CompactLagControl({
  checked,
  showLabel,
  onCheckedChange,
}: {
  checked: boolean;
  showLabel: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          data-tour="question-engine-toolbar-lag"
          className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors hover:!bg-muted hover:!text-foreground"
          onClick={() => onCheckedChange(!checked)}
        >
          <Gauge className="h-4 w-4" />
          {showLabel ? <span>Lag mode</span> : null}
          <Switch
            aria-label="Lag mode"
            checked={checked}
            onCheckedChange={onCheckedChange}
            onClick={(event) => event.stopPropagation()}
            className="ml-0.5 scale-90"
          />
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        Simulate the lag of the real UCAT test - adds a small delay every time
        you click a button
      </TooltipContent>
    </Tooltip>
  );
}

function CompactNextQuestionPopupControl({
  checked,
  showLabel,
  onCheckedChange,
}: {
  checked: boolean;
  showLabel: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors hover:!bg-muted hover:!text-foreground"
          onClick={() => onCheckedChange(!checked)}
        >
          <MessageSquareMore className="h-4 w-4" />
          {showLabel ? <span>Next question popup</span> : null}
          <Switch
            aria-label="Next question popup"
            checked={checked}
            onCheckedChange={onCheckedChange}
            onClick={(event) => event.stopPropagation()}
            className="ml-0.5 scale-90"
          />
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        Ask before moving to the next question after reviewing a stem
      </TooltipContent>
    </Tooltip>
  );
}

function getActivityLabel(kind: "practice" | "set" | "mock" | undefined) {
  switch (kind) {
    case "practice":
      return "Practice session";
    case "set":
      return "Set";
    case "mock":
      return "Mock";
    default:
      return "Tutorial";
  }
}

export function UcatExamToolbar({
  layout,
  onLayoutChange,
}: {
  layout: ExamToolbarLayout;
  onLayoutChange?: (layout: ExamToolbarLayout) => void;
}) {
  const detailed = layout === "detailed_right";
  const { title, practice, requestExit } = useExamExperience();
  const { active } = useActiveExamAttempt();
  const { enabled: lagEnabled, setEnabled: setLagEnabled } = useUcatLag();
  const { preferences, updatePreferences } = useUcatInterfacePreferences();
  const hasRoomForActionLabels = useMediaQuery("(min-width: 700px)");
  const activityLabel = getActivityLabel(active?.kind);

  const toggleLayout = () => {
    const next: ExamToolbarLayout = detailed ? "compact_top" : "detailed_right";
    if (onLayoutChange) {
      onLayoutChange(next);
      return;
    }
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
      <TooltipProvider delayDuration={200}>
        <aside
          data-tour="question-engine-settings"
          className="flex h-12 min-w-0 items-center gap-1 border-b bg-background px-3 shadow-sm"
        >
          <CompactToolbarTitle title={title} />
          {practice ? (
            <>
              <CompactMetric
                title={`Practice time ${formatDuration(practice.elapsedSeconds)}`}
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
          <CompactLagControl
            checked={lagEnabled}
            showLabel={hasRoomForActionLabels}
            onCheckedChange={setLagEnabled}
          />
          {practice?.reviewAfterEachStem ? (
            <CompactNextQuestionPopupControl
              checked={preferences.nextQuestionPopupEnabled}
              showLabel={hasRoomForActionLabels}
              onCheckedChange={(enabled) => {
                void updatePreferences({
                  nextQuestionPopupEnabled: enabled,
                });
              }}
            />
          ) : null}
          <CompactAction
            label="Move right"
            tooltip="Move toolbar to the right"
            icon={<LayoutPanelTop className="h-4 w-4" />}
            onClick={toggleLayout}
            showLabel={hasRoomForActionLabels}
            className="hidden md:inline-flex"
            tourTarget="question-engine-toolbar-layout"
          />
          <CompactAction
            label="Report bug"
            tooltip="Report a bug"
            icon={<Bug className="h-4 w-4" />}
            onClick={() => void reportBug()}
            showLabel={hasRoomForActionLabels}
            tourTarget="question-engine-toolbar-report"
          />
          {practice?.onFinishPractice ? (
            <CompactAction
              label="Finish"
              tooltip="Finish practice"
              icon={<Square className="h-4 w-4" />}
              onClick={practice.onFinishPractice}
              filled
              showLabel={hasRoomForActionLabels}
            />
          ) : null}
          <CompactAction
            label="Exit"
            tooltip="Exit session"
            icon={<LogOut className="h-4 w-4" />}
            onClick={requestExit}
            destructive
            showLabel={hasRoomForActionLabels}
            tourTarget="question-engine-toolbar-exit"
          />
        </aside>
      </TooltipProvider>
    );
  }

  return (
    <aside
      data-tour="question-engine-settings"
      className="flex h-full w-64 shrink-0 flex-col border-l bg-background p-4 shadow-sm"
    >
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {activityLabel}
          </p>
          <h1 className="mt-1 text-base font-semibold leading-snug">{title}</h1>
        </div>
        {practice ? (
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Timing
            </p>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span>Practice time</span>
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
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                {[
                  [
                    "Answered",
                    practice.stats?.totalQuestionLabel === "Unlimited"
                      ? String(practice.stats?.answeredCount ?? 0)
                      : `${practice.stats?.answeredCount ?? 0} / ${practice.stats?.totalQuestionLabel ?? "—"}`,
                    "col-span-2",
                  ],
                  ["Correct", String(practice.stats?.correctCount ?? 0), ""],
                  [
                    "Incorrect",
                    String(practice.stats?.incorrectCount ?? 0),
                    "",
                  ],
                ].map(([label, value, className]) => (
                  <div
                    key={label}
                    className={cn("rounded-lg bg-muted/60 p-2", className)}
                  >
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
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  data-tour="question-engine-toolbar-lag"
                  className="flex h-9 cursor-pointer items-center justify-between rounded-md px-2 transition-colors hover:!bg-muted/80"
                  onClick={() => setLagEnabled(!lagEnabled)}
                >
                  <span className="inline-flex items-center gap-2 text-sm">
                    <Gauge className="h-4 w-4" />
                    Lag mode
                  </span>
                  <Switch
                    aria-label="Lag mode"
                    checked={lagEnabled}
                    onCheckedChange={setLagEnabled}
                    onClick={(event) => event.stopPropagation()}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                Simulate the lag of the real UCAT test - adds a small delay
                every time you click a button
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {practice?.reviewAfterEachStem ? (
            <div
              className="flex min-h-9 cursor-pointer items-center justify-between gap-3 rounded-md px-2 transition-colors hover:!bg-muted/80"
              onClick={() => {
                void updatePreferences({
                  nextQuestionPopupEnabled:
                    !preferences.nextQuestionPopupEnabled,
                });
              }}
            >
              <span className="inline-flex items-center gap-2 text-sm">
                <MessageSquareMore className="h-4 w-4 shrink-0" />
                Next question popup
              </span>
              <Switch
                aria-label="Next question popup"
                checked={preferences.nextQuestionPopupEnabled}
                onCheckedChange={(enabled) => {
                  void updatePreferences({
                    nextQuestionPopupEnabled: enabled,
                  });
                }}
                onClick={(event) => event.stopPropagation()}
              />
            </div>
          ) : null}
          <Button
            data-tour="question-engine-toolbar-layout"
            variant="ghost"
            className="w-full justify-start gap-2 px-2 hover:!bg-muted/80 hover:!text-foreground"
            onClick={toggleLayout}
          >
            <LayoutPanelTop className="h-4 w-4" />
            Move toolbar to top
          </Button>
          <Button
            data-tour="question-engine-toolbar-report"
            variant="ghost"
            className="w-full justify-start gap-2 px-2 hover:!bg-muted/80 hover:!text-foreground"
            onClick={() => void reportBug()}
          >
            <Bug className="h-4 w-4" />
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
        <Button
          data-tour="question-engine-toolbar-exit"
          variant="destructive"
          className="w-full"
          onClick={requestExit}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Exit session
        </Button>
      </div>
    </aside>
  );
}
