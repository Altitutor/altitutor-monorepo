/** @jest-environment node */
import { prepareReportingQuery } from "../reporting";

describe("restricted business reporting queries", () => {
  it("allows new cohorts, joins and windowed analysis over approved datasets", () => {
    expect(
      prepareReportingQuery(`with cohort as (select id from admin_reporting.students where status = 'ACTIVE')
      select c.id, count(*) over () as total from cohort c join admin_reporting.classes_students e on e.student_id = c.id`),
    ).toContain("admin_reporting");
  });
  it.each([
    "delete from admin_reporting.students",
    "select 1; select 2",
    "with x as (delete from public.students returning *) select * from x",
    "select * from public.students",
    "select * from auth.users",
    "select pg_read_file('/etc/passwd')",
    "select set_config('role', 'postgres', false)",
    "select public.is_adminstaff_active()",
    "select 'auth.users'::regclass",
    "select * into temporary stolen from admin_reporting.students",
    "select * from admin_reporting.students for update",
  ])("rejects authority outside reporting: %s", (sql) => {
    expect(() => prepareReportingQuery(sql)).toThrow();
  });
});
