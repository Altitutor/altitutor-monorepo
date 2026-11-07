"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { formatInterviewReviewDate, interviewText, type InterviewReviewMock, type Json } from "@altitutor/shared";
import { Badge } from "./badge";
import { Button } from "./button";
import { cn } from "../lib/cn";

function ReviewDisclosure({ title, detail, children }: { title: ReactNode; detail?: ReactNode; children: ReactNode }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary">
        <ChevronRight aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out motion-reduce:transition-none", open && "rotate-90")} />
        <span className="min-w-0 flex-1">{title}</span>
        {detail && <span className="shrink-0 text-right tabular-nums">{detail}</span>}
      </button>
      <div id={id} inert={!open} className={cn("grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="min-h-0 overflow-hidden">
          <div className="ml-4 space-y-0.5 border-l border-black/[0.08] pb-1 pl-3 dark:border-white/10">{children}</div>
        </div>
      </div>
    </div>
  );
}

function Feedback({ content }: { content: Json }) {
  const text = interviewText(content).trim();
  return text ? <p className="px-2 py-1 text-sm whitespace-pre-wrap text-muted-foreground">{text}</p> : null;
}

function scoreLabel(score: number | null, maximum: number | null) {
  return score === null ? "—" : maximum === null ? String(score) : `${score} / ${maximum}`;
}

export function InterviewReviewMockHistory({ round, resultHref }: { round: InterviewReviewMock; resultHref?: string }) {
  return (
    <ReviewDisclosure detail={<strong>{scoreLabel(round.score, round.maximumPoints)}</strong>}
      title={<>
        <strong className="block">{round.title}</strong>
        <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {formatInterviewReviewDate(round.date)}
          {!round.released && <Badge variant="secondary">Unreleased</Badge>}
        </span>
      </>}>
      {round.stations.map((station, index) => (
        <ReviewDisclosure key={station.id} title={<strong className="font-medium">{station.name || `Station ${index + 1}`}</strong>}
          detail={<span className="text-muted-foreground">{scoreLabel(station.score, station.maximumPoints)}</span>}>
          {station.notAssessedReason && <p className="px-2 py-1 text-sm text-muted-foreground">{station.notAssessedReason}</p>}
          <Feedback content={station.feedback} />
          {station.questions.map((question, questionIndex) => (
            <ReviewDisclosure key={question.id} title={<span className="text-xs"><strong>Q{questionIndex + 1}</strong> · {interviewText(question.title)}</span>}>
              {interviewText(question.feedback).trim() ? <Feedback content={question.feedback} /> :
                <p className="px-2 py-1 text-xs text-muted-foreground">No written feedback.</p>}
            </ReviewDisclosure>
          ))}
        </ReviewDisclosure>
      ))}
      {resultHref && <div className="px-2 py-1"><Button asChild variant="outline" size="sm"><Link href={resultHref}>View mock</Link></Button></div>}
    </ReviewDisclosure>
  );
}
