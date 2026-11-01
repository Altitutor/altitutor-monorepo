import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/shared/lib/supabase/server-ssr";
import { captureApiError } from "@/lib/sentry/capture-api-error";
import { parseBoard } from "@/features/onboarding/lib/parseBoard";
import {
  defaultDeadlines,
  isOpen,
  lifecycle,
  nextActions,
  stages,
} from "@/features/onboarding/lib/model";
import type {
  StudentDirectoryEntry,
  StudentDirectoryPage,
} from "@/features/students/types/directory";

const requestSchema = z.object({
  search: z.string().max(500).default(""),
  searchFields: z
    .array(z.enum(["name", "email", "phone"]))
    .max(3)
    .default(["name", "email", "phone"]),
  filters: z
    .record(
      z.string(),
      z.array(z.union([z.string().max(200), z.number()])).max(100),
    )
    .default({}),
  sortBy: z
    .enum([
      "status",
      "first_name",
      "last_name",
      "created_at",
      "online_since",
      "stage",
      "__none__",
    ])
    .nullable()
    .default("last_name"),
  sortDirection: z.enum(["asc", "desc"]).default("asc"),
  groupBy: z
    .enum([
      "stage",
      "status",
      "curriculum",
      "year_level",
      "account_class",
      "__none__",
    ])
    .nullable()
    .optional(),
  page: z.number().int().min(1).max(100000).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
});

export async function searchStudentDirectory(request: Request) {
  try {
    const db = await createClient();
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser();
    if (authError || !user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await db.rpc("is_adminstaff_active");
    if (access.error || !access.data)
      return NextResponse.json(
        { error: "Active AdminStaff access required" },
        { status: 403 },
      );
    const parsed = requestSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid directory request" },
        { status: 400 },
      );
    const [board, settings] = await Promise.all([
      db.rpc("onboarding_journeys_board"),
      db.from("onboarding_settings").select("*").eq("id", true).single(),
    ]);
    if (board.error) throw board.error;
    if (settings.error) throw settings.error;
    const journeys = parseBoard(board.data);
    const deadlines = {
      ...defaultDeadlines,
      ...((settings.data.action_business_days as Record<string, number>) ?? {}),
    };
    const now = new Date();
    const index = journeys.map((journey) => {
      const actions = nextActions(
        journey,
        deadlines,
        now,
        settings.data.followup_business_days,
      );
      return {
        id: journey.id,
        student_id: journey.student_id,
        stage: stages[lifecycle(journey)],
        open: isOpen(journey),
        ours: actions.some((action) => !action.waiting),
        waiting: actions.some((action) => action.waiting),
        overdue: actions.some((action) => action.overdue),
        subject_ids: journey.evidence.subjects.map((subject) => subject.id),
      };
    });
    const result = await db.rpc("search_student_directory_admin", {
      p_request: parsed.data,
      p_journeys: index,
    });
    if (result.error) throw result.error;
    const payload = result.data as unknown as {
      entries: Array<StudentDirectoryEntry & { journey_id: string | null }>;
      total: number;
    };
    const byId = new Map(journeys.map((journey) => [journey.id, journey]));
    const page: StudentDirectoryPage = {
      total: payload.total,
      deadlines,
      entries: payload.entries.map(({ journey_id, ...entry }) => {
        const journey = journey_id ? byId.get(journey_id) : undefined;
        return {
          ...entry,
          journey,
          actions: journey
            ? nextActions(
                journey,
                deadlines,
                now,
                settings.data.followup_business_days,
              )
            : [],
        };
      }),
    };
    return NextResponse.json(page);
  } catch (error) {
    captureApiError(error, "/api/students/directory");
    return NextResponse.json(
      { error: "Unable to load Students. Please try again." },
      { status: 500 },
    );
  }
}
