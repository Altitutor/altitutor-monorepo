import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@altitutor/shared";

type StudentSessionRow =
  Database["public"]["Views"]["vstudent_sessions"]["Row"];
type StudentSessionResourceRow =
  Database["public"]["Views"]["vstudent_ucat_sessions_resources"]["Row"];

export type StudentUcatSession = StudentSessionRow & {
  session_id: string;
  class_id: string;
  subject_name: string;
};

export type StudentUcatSessionResource =
  | {
      id: string;
      type: "set";
      question_set_id: string;
    }
  | {
      id: string;
      type: "mock";
      ucat_mock_id: string;
    }
  | {
      id: string;
      type: "stem";
      question_stem_id: string;
    };

type SupabaseClient = ReturnType<typeof getSupabaseBrowserClient>;

function getClient(): SupabaseClient {
  return getSupabaseBrowserClient();
}

/** Adelaide calendar day of `startAtIso` vs “today” in Adelaide (ordering + labels). */
export function getUcatSessionAdelaideDayStatus(
  startAtIso: string | null | undefined,
): "past" | "today" | "future" {
  if (!startAtIso) return "future";

  const adelaideTz = "Australia/Adelaide";
  const now = new Date();

  const todayParts = new Intl.DateTimeFormat("en-AU", {
    timeZone: adelaideTz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});

  const startParts = new Intl.DateTimeFormat("en-AU", {
    timeZone: adelaideTz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(new Date(startAtIso))
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});

  const todayKey = `${todayParts.year}-${todayParts.month}-${todayParts.day}`;
  const startKey = `${startParts.year}-${startParts.month}-${startParts.day}`;

  if (startKey === todayKey) return "today";
  if (startKey < todayKey) return "past";
  return "future";
}

function sortSessionsChronologicalAsc(sessions: StudentUcatSession[]): void {
  sessions.sort((a, b) => {
    const aTime = a.start_at ? new Date(a.start_at).getTime() : 0;
    const bTime = b.start_at ? new Date(b.start_at).getTime() : 0;
    return aTime - bTime;
  });
}

export async function getStudentUcatSessions(): Promise<StudentUcatSession[]> {
  const supabase = getClient();

  const { data: sessionsData, error: sessionsError } = await supabase
    .from("vstudent_sessions")
    .select("*");
  if (sessionsError) throw sessionsError;

  const sessions = (sessionsData ?? []).filter(
    (s): s is StudentUcatSession =>
      !!s.session_id &&
      !!s.class_id &&
      (s.subject_name ?? "").toUpperCase() === "UCAT",
  );

  sortSessionsChronologicalAsc(sessions);

  return sessions;
}

export async function getStudentUcatSessionResources(
  sessionId: string,
): Promise<StudentUcatSessionResource[]> {
  const supabase = getClient();

  const { data, error } = await supabase
    .from("vstudent_ucat_sessions_resources")
    .select(
      "id, session_id, question_set_id, ucat_mock_id, question_stem_id, index",
    )
    .eq("session_id", sessionId)
    .order("index", { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as StudentSessionResourceRow[];

  return rows
    .map((row): StudentUcatSessionResource | null => {
      if (row.question_set_id) {
        return {
          id: row.id ?? "",
          type: "set",
          question_set_id: row.question_set_id,
        };
      }
      if (row.ucat_mock_id) {
        return {
          id: row.id ?? "",
          type: "mock",
          ucat_mock_id: row.ucat_mock_id,
        };
      }
      if (row.question_stem_id) {
        return {
          id: row.id ?? "",
          type: "stem",
          question_stem_id: row.question_stem_id,
        };
      }
      return null;
    })
    .filter((item): item is StudentUcatSessionResource => item !== null);
}
