/** @jest-environment node */
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import { fetchSubsidies } from "../subsidies";

let mockAdminClient: SupabaseClient<Database>;
jest.mock("@/shared/lib/supabase/client", () => ({
  getSupabaseClient: () => mockAdminClient,
}));

// Run only via the owned dev:isolated exec environment, never against a remote DB.
const localTest =
  process.env.RUN_LOCAL_SUBSIDIES_TESTS === "1" ? describe : describe.skip;
localTest("subsidies list against the owned local database", () => {
  let database: SupabaseClient<Database>;
  let studentId: string;
  let subjectId: string;
  const surname = `Subsidies-${randomUUID()}`;
  beforeAll(async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname))
      throw new Error("Local DB required");
    database = createClient<Database>(
      url,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    mockAdminClient = createClient<Database>(
      url,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const login = await mockAdminClient.auth.signInWithPassword({
      email: "admin@altitutor.test",
      password: "test-password",
    });
    if (login.error) throw login.error;
    studentId = randomUUID();
    const student = await database
      .from("students")
      .insert({
        id: studentId,
        first_name: "List",
        last_name: surname,
        status: "ACTIVE",
      });
    if (student.error) throw student.error;
    const subject = await database
      .from("subjects")
      .select("id")
      .limit(1)
      .single();
    if (subject.error) throw subject.error;
    subjectId = subject.data.id;
    const subsidies = await database.from("student_subsidies").insert([
      {
        student_id: studentId,
        subject_id: subjectId,
        billing_type: "CLASS",
        currency: "AUD",
        price_cents: 0,
        effective_from: "2020-01-01",
        effective_until: "2090-01-01",
      },
      {
        student_id: studentId,
        subject_id: subjectId,
        billing_type: "CLASS",
        currency: "AUD",
        price_cents: 1234,
        effective_from: "2000-01-01",
        effective_until: "2001-01-01",
      },
      {
        student_id: studentId,
        subject_id: subjectId,
        billing_type: "CLASS",
        currency: "AUD",
        price_cents: 2345,
        effective_from: "2091-01-01",
        effective_until: null,
      },
    ]);
    if (subsidies.error) throw subsidies.error;
  });
  afterAll(async () => {
    if (!studentId) return;
    const result = await mockAdminClient.rpc("retire_student", {
      p_student_id: studentId,
    });
    if (result.error) throw result.error;
  });

  it("returns only the current subsidy for Active, including a zero price", async () => {
    const result = await fetchSubsidies({
      search: `List ${surname}`,
      statuses: ["active"],
      page: 1,
      pageSize: 20,
    });
    expect(result.total).toBe(1);
    expect(result.subsidies.map((row) => row.price_cents)).toEqual([0]);
    expect(result.subsidies[0].student.id).toBe(studentId);
  });
  it("includes both future and expired windows for Inactive", async () => {
    const result = await fetchSubsidies({
      search: surname,
      statuses: ["inactive"],
      page: 1,
      pageSize: 20,
      sortBy: "price_cents",
      ascending: true,
    });
    expect(result.total).toBe(2);
    expect(result.subsidies.map((row) => row.price_cents)).toEqual([
      1234, 2345,
    ]);
  });
  it("counts the full filtered result while returning only the requested page", async () => {
    const result = await fetchSubsidies({
      search: surname,
      subjectIds: [subjectId],
      page: 2,
      pageSize: 1,
      sortBy: "price_cents",
      ascending: true,
    });
    expect(result.total).toBe(3);
    expect(result.subsidies.map((row) => row.price_cents)).toEqual([1234]);
  });
  it("can show both statuses and filter by subject", async () => {
    const result = await fetchSubsidies({
      search: surname,
      statuses: ["active", "inactive"],
      subjectIds: [randomUUID()],
      page: 1,
      pageSize: 20,
    });
    expect(result).toEqual({ subsidies: [], total: 0 });
  });
});
