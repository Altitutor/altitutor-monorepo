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
  type Journey,
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
  allPages: z.boolean().default(false),
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
    const input = parsed.data;
    const databaseAbort = new AbortController();
    const databaseSignal = AbortSignal.any([request.signal, databaseAbort.signal]);
    // Only these operations use evidence to decide which rows precede pagination.
    // Other requests can choose their page from cheap identities, then hydrate it.
    const globalEvidence = Boolean(
      input.sortBy === 'stage' || input.groupBy === 'stage'
      || input.filters.relationship?.includes('trial')
      || input.filters.onboardingStatus?.length || input.filters.queue?.length
      || input.filters.subject?.length,
    );
    type JourneyIdentity = Pick<Journey, 'id' | 'student_id' | 'created_at'>;
    const [onboarding, settings] = await Promise.all([
      (async (): Promise<{ journeys: Journey[]; identities: JourneyIdentity[] }> => {
        if (globalEvidence) {
          let board = await db.rpc('onboarding_journeys_read', { p_directory: true }).abortSignal(databaseSignal);
          if (board.error?.code === 'PGRST202') {
            // Preserve operation during a DB-first deployment or rollback.
            board = await db.rpc('onboarding_journeys_board').abortSignal(databaseSignal);
          }
          if (board.error) throw board.error;
          return { journeys: parseBoard(board.data), identities: [] };
        }
        const identities = await collectTableRows(async (offset, limit) => {
          const result = await db.from('onboarding_journeys')
            .select('id, student_id, created_at', { count: 'exact' })
            .order('id').range(offset, offset + limit - 1).abortSignal(databaseSignal);
          if (result.error) throw result.error;
          return { rows: result.data, total: result.count ?? 0 };
        });
        return { journeys: [], identities };
      })(),
      db.from("onboarding_settings").select("*").eq("id", true).single(),
    ]);
    if (settings.error) throw settings.error;
    const journeys = onboarding.journeys;
    const deadlines = {
      ...defaultDeadlines,
      ...((settings.data.action_business_days as Record<string, number>) ?? {}),
    };
    const now = new Date();
    const index = globalEvidence ? journeys.map((journey) => {
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
    }) : onboarding.identities.map(({ id, student_id }) => ({ id, student_id }));
    type DirectoryResult = {
      entries: Array<StudentDirectoryEntry & { journey_id: string | null }>;
      total: number;
    };
    const sortByCheckIn = input.sortBy === 'time_since_last_check_in';
    const noClasses = input.filters.reconciliation?.includes('no-classes');
    const noPayment = input.filters.reconciliation?.includes('no-payment-method');
    const subsidies = input.filters.subsidy?.includes('current');
    const loadPage = async (page: number, pageSize: number) => {
      const result = await db.rpc("search_student_directory_admin", {
        p_request: { ...input, page, pageSize, sortBy: sortByCheckIn ? 'last_name' : input.sortBy },
        p_journeys: index,
      }).abortSignal(databaseSignal);
      if (result.error) throw result.error;
      return result.data as unknown as DirectoryResult;
    };
    const hydrate = async (payload: DirectoryResult): Promise<StudentDirectoryPage> => {
      let pageJourneys = globalEvidence ? journeys : [];
      if (!globalEvidence) {
        const students = new Set(payload.entries.filter(entry => entry.kind === 'student').map(entry => entry.id));
        const enquiries = new Set(payload.entries.filter(entry => entry.kind === 'enquiry').map(entry => entry.id));
        const ids = onboarding.identities.filter(identity =>
          identity.student_id ? students.has(identity.student_id) : enquiries.has(identity.id),
        ).map(identity => identity.id);
        for (let offset = 0; offset < ids.length; offset += 200) {
          const result = await db.rpc('onboarding_journeys_scoped', { p_journey_ids: ids.slice(offset, offset + 200) }).abortSignal(databaseSignal);
          if (result.error) throw result.error;
          pageJourneys.push(...parseBoard(result.data));
        }
        // Match the directory RPC's current-journey precedence exactly: open,
        // newest created timestamp, then UUID. A newer closure must not hide an
        // older still-open journey, and closed snapshots retain their evidence.
        pageJourneys = pageJourneys.sort((left, right) =>
          Number(isOpen(right)) - Number(isOpen(left))
          || Date.parse(right.created_at) - Date.parse(left.created_at)
          || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
        const byStudent = new Map<string, Journey>();
        const byJourney = new Map(pageJourneys.map(journey => [journey.id, journey]));
        for (const journey of pageJourneys) if (journey.student_id && !byStudent.has(journey.student_id)) byStudent.set(journey.student_id, journey);
        payload.entries = payload.entries.map(entry => {
          const journey = entry.kind === 'student' ? byStudent.get(entry.id) : byJourney.get(entry.id);
          return { ...entry, journey_id: journey?.id ?? null, stage: journey ? stages[lifecycle(journey)] : null };
        });
      }
      // Current and future placements both satisfy the missing-class queue.
      const studentIds = payload.entries.filter((row) => row.kind === 'student').map((row) => row.id);
      if (studentIds.length) {
        const loadEnrollments = (ids: string[]) => collectTableRows(async (offset, limit) => {
          const result = await db.from('classes_students')
            .select('student_id, enrolled_at, class:classes!inner(*, subject:subjects(*))', { count: 'exact' })
            .in('student_id', ids).eq('class.status', 'ACTIVE').is('class.deleted_at', null)
            .or(`unenrolled_at.is.null,unenrolled_at.gt.${now.toISOString()}`)
            .order('id').range(offset, offset + limit - 1).abortSignal(databaseSignal);
          if (result.error) throw result.error;
          return { rows: result.data, total: result.count ?? 0 };
        });
        const enrollments = [];
        for (let offset = 0; offset < studentIds.length; offset += 200) {
          enrollments.push(...await loadEnrollments(studentIds.slice(offset, offset + 200)));
        }
        for (const entry of payload.entries) if (entry.kind === 'student') {
          entry.student = { ...entry.student, classes: enrollments.filter((row) => row.student_id === entry.id).map((row) => ({ ...row.class, enrolled_at: row.enrolled_at })) };
        }
      }
      const byId = new Map(pageJourneys.map((journey) => [journey.id, journey]));
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
      return page;
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
      payload = { entries: input.allPages ? filtered : filtered.slice(offset, offset + input.pageSize), total: filtered.length };
    } else {
      payload = await loadPage(input.allPages ? 1 : input.page, input.allPages ? 200 : input.pageSize);
    }
    if (!input.allPages) return NextResponse.json(await hydrate(payload));

    // Board output is streamed with bounded page hydration. The JSON contract
    // stays identical, without buffering a complete serialized directory. A
    // failed/cancelled page never receives the closing JSON suffix, so the
    // client rejects it rather than displaying a successful partial board.
    const chunks = (async function* () {
      const total = payload.total;
      let emitted = 0;
      let pageNumber = 1;
      let batch = payload;
      payload = { entries: [], total };
      yield `{"total":${total},"deadlines":${JSON.stringify(deadlines)},"entries":[`;
      for (;;) {
        for (let offset = 0; offset < batch.entries.length; offset += 200) {
          const hydrated = await hydrate({ ...batch, entries: batch.entries.slice(offset, offset + 200) });
          for (const entry of hydrated.entries) {
            yield `${emitted ? ',' : ''}${JSON.stringify(entry)}`;
            emitted++;
          }
        }
        if (sortByCheckIn || noClasses || noPayment || subsidies || emitted >= total) break;
        batch = await loadPage(++pageNumber, 200);
        if (!batch.entries.length) throw new Error('Student directory changed; refresh to reload the board');
      }
      yield ']}';
    })();
    const encoder = new TextEncoder();
    return new Response(new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const next = await chunks.next();
          if (next.done) controller.close();
          else controller.enqueue(encoder.encode(next.value));
        } catch (error) {
          if (!databaseSignal.aborted) captureApiError(error, '/api/students/directory');
          databaseAbort.abort();
          controller.error(error);
        }
      },
      async cancel() {
        databaseAbort.abort();
        await chunks.return(undefined);
      },
    }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (!request.signal.aborted) captureApiError(error, "/api/students/directory");
    return NextResponse.json(
      { error: "Unable to load Students. Please try again." },
      { status: 500 },
    );
  }
}
