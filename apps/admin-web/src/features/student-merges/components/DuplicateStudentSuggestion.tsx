"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { mergeRead } from "../api";
import type { DuplicateCandidate } from "../types";

export function DuplicateStudentSuggestion({
  studentId,
}: {
  studentId: string;
}) {
  const { data } = useQuery({
    queryKey: ["student-duplicates", studentId],
    queryFn: ({ signal }) =>
      mergeRead<DuplicateCandidate[]>(
        `?student=${encodeURIComponent(studentId)}`,
        signal,
      ),
    staleTime: 60_000,
  });
  if (!data?.length) return null;
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
      <span>
        {data.length === 1
          ? "Possible duplicate student found."
          : `${data.length} possible duplicate students found.`}{" "}
      </span>
      <Link
        className="font-medium underline"
        href={`/settings/duplicate-students?student=${encodeURIComponent(studentId)}`}
      >
        Review possible matches
      </Link>
    </div>
  );
}
