"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useInterviewRound } from "../hooks/use-interviews";
import { InterviewError } from "./interview-ui";

/** Notifications use a stable round URL that remains useful after completion. */
export function InterviewRoundEntry({ id }: { id: string }) {
  const router = useRouter();
  const query = useInterviewRound(id);
  const destination = query.data
    ? query.data.phase === "completed"
      ? "results"
      : query.data.startedAt
        ? "live"
        : "waiting"
    : null;
  useEffect(() => {
    if (destination) router.replace(`/interviews/rounds/${id}/${destination}`);
  }, [destination, id, router]);
  return (
    <div className="py-8">
      <InterviewError error={query.error} retry={() => void query.refetch()} />
      {!query.error && "Opening your interview…"}
    </div>
  );
}
