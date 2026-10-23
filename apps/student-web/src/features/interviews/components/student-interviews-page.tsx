"use client";

import Link from "next/link";
import { Calendar, ChevronRight, Video, MapPin } from "lucide-react";
import { Badge, Button } from "@altitutor/ui";
import type { StudentInterviewRound } from "@altitutor/shared";
import {
  useInterviewAccess,
  useInterviewRounds,
} from "../hooks/use-interviews";
import { interviewResultsHref, interviewRoomHref } from "../lib/routes";
import { InterviewError } from "./interview-error";

function RoundCard({ round }: { round: StudentInterviewRound }) {
  const completed = round.phase === "completed";
  const active =
    !completed &&
    (Boolean(round.startedAt) ||
      !round.scheduledAt ||
      Date.parse(round.scheduledAt) <= Date.now());
  return (
    <article
      className={`rounded-xl border p-5 ${active ? "border-primary/30 bg-primary/5" : "bg-card"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{round.name}</h3>
            <Badge variant={active ? "default" : "secondary"}>
              {completed
                ? round.result
                  ? "Results available"
                  : "Awaiting results"
                : active
                  ? "Active"
                  : "Upcoming"}
            </Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {round.scheduledAt
                ? new Date(round.scheduledAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "Start when your tutor is ready"}
            </span>
            <span className="flex items-center gap-1.5">
              {round.delivery === "online" ? (
                <Video className="h-4 w-4" />
              ) : (
                <MapPin className="h-4 w-4" />
              )}
              {round.delivery === "online" ? "Online" : "In person"}
            </span>
            <span>{round.stations.length} stations</span>
          </div>
        </div>
        {completed ? (
          round.result ? (
            <Button asChild variant="outline">
              <Link href={interviewResultsHref(round.id)}>
                View results
                <ChevronRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          ) : null
        ) : (
          <Button asChild variant={active ? "default" : "outline"}>
            <Link href={interviewRoomHref(round.id)}>
              {round.startedAt ? "Rejoin interview" : "Enter waiting room"}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>
      {active && (
        <p className="mt-4 text-sm text-muted-foreground">
          Enter the waiting room to get ready. Your tutor starts each rotation.
        </p>
      )}
    </article>
  );
}

export function StudentInterviewsPage() {
  const access = useInterviewAccess();
  const rounds = useInterviewRounds();
  if (access.isPending)
    return (
      <p role="status" className="py-10">
        Loading interviews…
      </p>
    );
  if (access.error)
    return (
      <InterviewError
        error={access.error}
        retry={() => {
          void access.refetch();
        }}
      />
    );
  if (!access.data?.hasAccess)
    return (
      <div className="py-10">
        <h1 className="text-2xl font-semibold">Interviews</h1>
        <p className="mt-3 text-muted-foreground">
          An active Medicine interview enrolment is required to access
          interviews and past results.
        </p>
      </div>
    );
  if (rounds.isPending)
    return (
      <p role="status" className="py-10">
        Loading interviews…
      </p>
    );
  if (rounds.error)
    return (
      <InterviewError
        error={rounds.error}
        retry={() => {
          void rounds.refetch();
        }}
      />
    );
  const upcoming = rounds.data.filter((round) => round.phase !== "completed");
  const past = rounds.data.filter((round) => round.phase === "completed");
  return (
    <div className="space-y-8 py-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Interviews</h1>
        <p className="mt-2 text-muted-foreground">
          Join your mock interviews and review released feedback.
        </p>
      </header>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Active and upcoming</h2>
        {upcoming.length ? (
          upcoming.map((round) => <RoundCard key={round.id} round={round} />)
        ) : (
          <p className="rounded-xl border border-dashed p-6 text-muted-foreground">
            No upcoming interviews. Your tutor will invite you when a round is
            ready.
          </p>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Past interviews</h2>
        {past.length ? (
          past.map((round) => <RoundCard key={round.id} round={round} />)
        ) : (
          <p className="text-sm text-muted-foreground">
            Your completed interviews will appear here.
          </p>
        )}
      </section>
    </div>
  );
}
