"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@altitutor/ui";
import {
  useInterviewCatalog,
  useInterviewCommand,
  useInterviewRounds,
} from "../hooks/use-interviews";
import {
  InterviewError,
  InterviewPanel,
  InterviewSearch,
  InterviewSelect,
} from "./interview-ui";
import {
  tutorBtnOutline,
  tutorTableBodyRow,
  tutorTableHeaderRow,
  tutorTableShell,
} from "@/shared/lib/tutor-visual";

export function InterviewsPage() {
  const router = useRouter();
  const catalog = useInterviewCatalog();
  const rounds = useInterviewRounds();
  const command = useInterviewCommand();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("updated");
  const create = async () => {
    const id = crypto.randomUUID();
    await command.mutateAsync({
      type: "saveInterview",
      commandId: crypto.randomUUID(),
      expectedVersion: 0,
      interview: {
        id,
        name: "Untitled interview",
        readingTimeSeconds: 120,
        questionTimeSeconds: 480,
        recordingEnabled: false,
        stations: [
          {
            id: crypto.randomUUID(),
            name: "Station 1",
            maximumPoints: 6,
            questions: [],
          },
        ],
        archived: false,
      },
    });
    router.push(`/interviews/${id}`);
  };
  const interviews = (catalog.data?.interviews ?? [])
    .filter(
      (interview) =>
        !interview.archived &&
        interview.name.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : b.updatedAt.localeCompare(a.updatedAt),
    );
  const active = (rounds.data ?? []).filter(
    (round) => round.phase !== "completed",
  );
  const past = (rounds.data ?? []).filter(
    (round) => round.phase === "completed",
  );
  return (
    <div className="space-y-6 py-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Interviews</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Prepare interviews, join your rounds and review results.
          </p>
        </div>
        <Button
          disabled={command.isPending}
          onClick={() => void create().catch(() => undefined)}
        >
          New interview
        </Button>
      </div>
      <InterviewError
        error={catalog.error ?? rounds.error ?? command.error}
        retry={() => {
          void catalog.refetch();
          void rounds.refetch();
        }}
      />
      {active.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">Active and upcoming rounds</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {active.map((round) => (
              <InterviewPanel key={round.id}>
                <div className="flex justify-between gap-3">
                  <h3 className="font-semibold">{round.name}</h3>
                  <Badge variant="secondary">
                    {round.startedAt
                      ? round.phase
                      : round.scheduledAt
                        ? "Scheduled"
                        : "Waiting room"}
                  </Badge>
                </div>
                <p className="my-3 text-sm text-muted-foreground">
                  {round.scheduledAt
                    ? new Date(round.scheduledAt).toLocaleString()
                    : "Ready to join"}{" "}
                  · {round.delivery === "online" ? "Online" : "In person"} ·{" "}
                  {round.students.length} students
                </p>
                <Button asChild variant="outline" className={tutorBtnOutline}>
                  <Link
                    href={`/interviews/rounds/${round.id}/${round.startedAt ? "live" : "waiting"}`}
                  >
                    {round.startedAt
                      ? "Rejoin interview"
                      : "Enter waiting room"}
                  </Link>
                </Button>
              </InterviewPanel>
            ))}
          </div>
        </section>
      )}
      <InterviewSearch
        value={search}
        onChange={setSearch}
        placeholder="Search interviews…"
      >
        <div className="w-44">
          <InterviewSelect
            label="Sort interviews"
            value={sort}
            options={[
              { id: "updated", label: "Recently updated" },
              { id: "name", label: "Name" },
            ]}
            onChange={(value) => setSort(value ?? "updated")}
          />
        </div>
      </InterviewSearch>
      <div className={tutorTableShell}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className={tutorTableHeaderRow}>
              {[
                "Interview",
                "Stations",
                "Questions",
                "Reading / answer",
                "Total points",
                "",
              ].map((heading, index) => (
                <th key={index} className="p-4 font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {interviews.map((interview) => (
              <tr key={interview.id} className={tutorTableBodyRow}>
                <td className="p-4 font-medium">
                  <Link
                    className="hover:underline"
                    href={`/interviews/${interview.id}`}
                  >
                    {interview.name}
                  </Link>
                </td>
                <td className="p-4">{interview.stations.length}</td>
                <td className="p-4">
                  {interview.stations.reduce(
                    (sum, station) => sum + station.questions.length,
                    0,
                  )}
                </td>
                <td className="p-4">
                  {interview.readingTimeSeconds / 60}m /{" "}
                  {interview.questionTimeSeconds / 60}m
                </td>
                <td className="p-4">
                  {interview.stations.reduce(
                    (sum, station) => sum + station.maximumPoints,
                    0,
                  )}
                </td>
                <td className="p-4">
                  <Button asChild variant="outline" className={tutorBtnOutline}>
                    <Link href={`/interviews/${interview.id}`}>Edit</Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!interviews.length && (
          <p className="p-8 text-center text-muted-foreground">
            {catalog.isPending
              ? "Loading interviews…"
              : "No interviews yet. Create one to start building your stations."}
          </p>
        )}
      </div>
      {past.length > 0 && (
        <InterviewPanel title="Past rounds">
          <div className="divide-y">
            {past.map((round) => (
              <div
                className="flex items-center justify-between gap-4 py-4"
                key={round.id}
              >
                <div className="space-y-1">
                  <p className="font-medium">{round.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(
                      round.startedAt ?? round.createdAt,
                    ).toLocaleDateString()}{" "}
                    ·{" "}
                    {round.releasedResults.length ? "Released" : "Not released"}
                  </p>
                </div>
                <Button asChild variant="outline" className={tutorBtnOutline}>
                  <Link href={`/interviews/rounds/${round.id}/results`}>
                    Review results
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </InterviewPanel>
      )}
    </div>
  );
}
