import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/shared/lib/supabase/server-ssr";
import { studentGroup } from '../utils/studentGroup';
import { currentSubsidies } from '../api/currentSubsidies';
import { loadStudentsWithoutClasses } from '@/features/reconciliation/api/studentsWithoutClasses';
import { compareTimeSinceCheckIn, loadCheckInDates } from '@/features/reconciliation/api/checkInDates';
import { collectTableRows } from '@/shared/utils/tablePages';
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
      "time_since_last_check_in",
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
    type DirectoryResult = {
      entries: Array<StudentDirectoryEntry & { journey_id: string | null }>;
      total: number;
    };
    const input = parsed.data;
    const sortByCheckIn = input.sortBy === 'time_since_last_check_in';
    const noClasses = input.filters.reconciliation?.includes('no-classes');
    const noPayment = input.filters.reconciliation?.includes('no-payment-method');
    const subsidies = input.filters.subsidy?.includes('current');
    const loadPage = async (page: number, pageSize: number) => {
      const result = await db.rpc("search_student_directory_admin", {
        p_request: { ...input, page, pageSize, sortBy: sortByCheckIn ? 'last_name' : input.sortBy },
        p_journeys: index,
      });
      if (result.error) throw result.error;
      return result.data as unknown as DirectoryResult;
    };
    let payload: DirectoryResult;
    if (sortByCheckIn || noClasses || noPayment || subsidies) {
      const [rows, classMatches, paymentMatches, subsidyMatches, dates] = await Promise.all([
        collectTableRows(async (offset, limit) => {
          const result = await loadPage(offset / limit + 1, limit);
          return { rows: result.entries, total: result.total };
        }),
        noClasses ? loadStudentsWithoutClasses(db) : [],
        noPayment ? collectTableRows(async (offset, limit) => {
          const result = await db.from('vadmin_reconciliation_students_without_payment_method')
            .select('student_id', { count: 'exact' }).order('student_id').range(offset, offset + limit - 1);
          if (result.error) throw result.error;
          return { rows: result.data, total: result.count ?? 0 };
        }) : [],
        subsidies ? (async () => {
          const ids = new Set<string>();
          const size = 500;
          for (let offset = 0; ; offset += size) {
            const { data, error } = await currentSubsidies(db, now.toISOString()).order('id').range(offset, offset + size - 1);
            if (error) throw error;
            for (const row of data) ids.add(row.student_id);
            if (data.length < size) return ids;
          }
        })() : new Set<string>(),
        sortByCheckIn ? loadCheckInDates(db, 'student') : ({} as Record<string, string>),
      ]);
      const reconciliationIds = new Set([...classMatches, ...paymentMatches].map((row) => row.student_id));
      const filtered = rows.filter((row) => {
        if (!noClasses && !noPayment && !subsidies) return true;
        if (row.kind !== 'student') return false;
        return (!(noClasses || noPayment) || reconciliationIds.has(row.student.id))
          && (!subsidies || subsidyMatches.has(row.student.id));
      });
      if (sortByCheckIn) {
        const groups = new Map<string, number>();
        const group = (row: StudentDirectoryEntry) => studentGroup(row, input.groupBy ?? null);
        for (const row of filtered) if (!groups.has(group(row))) groups.set(group(row), groups.size);
        filtered.sort((left, right) =>
          (groups.get(group(left)) ?? 0) - (groups.get(group(right)) ?? 0)
          || compareTimeSinceCheckIn(dates[left.id], dates[right.id], input.sortDirection === 'asc')
          || left.id.localeCompare(right.id));
      }
      const offset = (input.page - 1) * input.pageSize;
      payload = { entries: filtered.slice(offset, offset + input.pageSize), total: filtered.length };
    } else {
      payload = await loadPage(input.page, input.pageSize);
    }
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
