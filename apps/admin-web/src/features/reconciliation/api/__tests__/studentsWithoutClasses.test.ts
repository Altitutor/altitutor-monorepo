/** @jest-environment node */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import { loadStudentsWithoutClasses } from "../studentsWithoutClasses";

// A local Data API fixture at the database boundary, using the real query client.
function fixture(enrolledAt: string, unenrolledAt: string | null = null) {
  const student = {
    id: "student",
    first_name: "Hannah",
    last_name: "Lewis",
    created_at: "",
    updated_at: "",
  };
  const subject = {
    id: "subject",
    name: "English",
    short_name: "ENGL",
    long_name: "English",
    curriculum: "SACE",
    year_level: 12,
  };
  const rows: Record<string, Record<string, unknown>[]> = {
    students: [student],
    students_subjects: [{ student_id: student.id, created_at: "", subject }],
    students_online_access_manual: [],
    classes_students: [
      {
        student_id: student.id,
        enrolled_at: enrolledAt,
        unenrolled_at: unenrolledAt,
        class: { subject_id: subject.id },
      },
    ],
  };
  return createClient<Database>("http://local-fixture.test", "fixture-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input) => {
        const url = new URL(String(input));
        let result = rows[url.pathname.split("/").at(-1)!] ?? [];
        const starts = url.searchParams.get("enrolled_at");
        if (starts?.startsWith("lte."))
          result = result.filter(
            (row) => String(row.enrolled_at) <= starts.slice(4),
          );
        const ends = url.searchParams
          .get("or")
          ?.match(/unenrolled_at.gt.([^)]*)/);
        if (ends)
          result = result.filter(
            (row) =>
              row.unenrolled_at == null || String(row.unenrolled_at) > ends[1],
          );
        const offset = Number(url.searchParams.get("offset") ?? 0);
        const limit = Number(url.searchParams.get("limit") ?? 1000);
        return new Response(
          JSON.stringify(result.slice(offset, offset + limit)),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  });
}

it("does not flag a student whose assigned subject already has a future class placement", async () => {
  expect(
    await loadStudentsWithoutClasses(fixture("2099-01-01T00:00:00Z")),
  ).toEqual([]);
});

it("still flags a subject whose only class enrolment has ended", async () => {
  const rows = await loadStudentsWithoutClasses(
    fixture("2020-01-01T00:00:00Z", "2021-01-01T00:00:00Z"),
  );
  expect(rows.map((row) => [row.student_id, row.subject_id])).toEqual([
    ["student", "subject"],
  ]);
});

it("does not flag a student with a current class placement", async () => {
  expect(
    await loadStudentsWithoutClasses(fixture("2020-01-01T00:00:00Z")),
  ).toEqual([]);
});
