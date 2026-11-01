"use client";
import type { Tables } from "@altitutor/shared";
import { keepPreviousData, useQuery, type QueryClient } from "@tanstack/react-query";
import { getSupabaseClient } from "@/shared/lib/supabase/client";
import { parseBoard } from "../lib/parseBoard";
import { evidenceSchema, type Journey } from "../lib/model";

export const onboardingKey = ["onboarding"] as const;

export async function invalidateOnboarding(client: QueryClient) {
  await Promise.all([
    client.invalidateQueries({ queryKey: onboardingKey }),
    client.invalidateQueries({ queryKey: ['students', 'directory'] }),
  ]);
}

function missingBoardFunction(error: { code?: string; message?: string }) {
  return (
    error.code === "PGRST202" ||
    (error.message?.includes("onboarding_journeys_board") ?? false)
  );
}

let boardRpcAvailable: boolean | null = null;

// Hosted databases pick up onboarding_journeys_board when the migration ships.
// Until then, reuse closure snapshots and only call evidence for open journeys.

async function fetchJourneysFallback(): Promise<Journey[]> {
  const db = getSupabaseClient();
  const rows: Journey[] = [];
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await db
      .from("onboarding_journeys")
      .select("*, onboarding_action_preferences(*)")
      .order("created_at", { ascending: false })
      .order("id")
      .range(offset, offset + 199);
    if (error) throw error;
    rows.push(
      ...(await Promise.all(
        data.map(async ({ onboarding_action_preferences, ...journey }) => {
          const stored = journey.closed_evidence;
          if (stored) {
            return {
              ...journey,
              preferences: onboarding_action_preferences,
              evidence: evidenceSchema.parse(stored),
            };
          }
          const result = await db.rpc("onboarding_evidence", {
            p_journey_id: journey.id,
          });
          if (result.error) throw result.error;
          return {
            ...journey,
            preferences: onboarding_action_preferences,
            evidence: evidenceSchema.parse(result.data),
          };
        }),
      )),
    );
    if (data.length < 200) return rows;
  }
}

async function fetchJourneys(): Promise<Journey[]> {
  if (boardRpcAvailable !== false) {
    const { data, error } = await getSupabaseClient().rpc(
      "onboarding_journeys_board",
    );
    if (!error) {
      boardRpcAvailable = true;
      return parseBoard(data);
    }
    if (!missingBoardFunction(error)) throw error;
    boardRpcAvailable = false;
  }
  return fetchJourneysFallback();
}

async function fetchJourneysWithStudentStatus() {
  const journeys = await fetchJourneys();
  const studentIds = [
    ...new Set(
      journeys.flatMap((journey) =>
        journey.student_id ? [journey.student_id] : [],
      ),
    ),
  ];
  const deletedIds = new Set<string>();
  const statuses = new Map<string, Tables<"students">["status"]>();
  // Bound each request below the API row limit and keep URLs small.
  for (let offset = 0; offset < studentIds.length; offset += 200) {
    const { data, error } = await getSupabaseClient()
      .from("students")
      .select("id, status, deleted_at")
      .in("id", studentIds.slice(offset, offset + 200));
    if (error) throw error;
    for (const student of data) {
      statuses.set(student.id, student.status);
      if (student.deleted_at) deletedIds.add(student.id);
    }
  }
  return journeys.filter(journey => !journey.student_id || !deletedIds.has(journey.student_id)).map((journey) => ({
    ...journey,
    student_status: journey.student_id
      ? (statuses.get(journey.student_id) ?? null)
      : null,
  }));
}

export function useOnboardingJourneys() {
  return useQuery({
    queryKey: [...onboardingKey, "journeys"],
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
    queryFn: fetchJourneysWithStudentStatus,
  });
}
export function useOnboardingSettings() {
  return useQuery({
    queryKey: [...onboardingKey, "settings"],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from("onboarding_settings")
        .select("*")
        .eq("id", true)
        .single();
      if (error) throw error;
      return data;
    },
  });
}
