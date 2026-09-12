/** @jest-environment node */
import { runReportingQuery } from "../reporting";

const integration = process.env.ADMIN_REPORTING_DATABASE_URL
  ? describe
  : describe.skip;
integration("dedicated reporting connection", () => {
  it("executes real aggregates across all eight data areas", async () => {
    const queries = [
      "student_product_acquisition_attributions",
      "students",
      "domain_events",
      "sessions",
      "invoices",
      "messages",
      "student_practice_sessions",
      "projects",
    ];
    for (const table of queries) {
      const result = await runReportingQuery(
        `select count(*) as total from admin_reporting.${table}`,
      );
      expect(result.rows).toHaveLength(1);
      expect(Number(result.rows[0].total)).toBeGreaterThanOrEqual(0);
      expect(result.truncated).toBe(false);
    }
  });
  it("executes a novel cohort, relationship join and windowed count", async () => {
    const result = await runReportingQuery(`with cohort as (
      select id from admin_reporting.students where status = 'ACTIVE'
    ) select s.id, count(distinct p.parent_id) as parents, count(*) over() as cohort_size
      from cohort s left join admin_reporting.parents_students p on p.student_id = s.id
      group by s.id`);
    expect(result.rows.length).toBeGreaterThan(0);
    expect(
      result.rows.every(
        (row) => Number(row.cohort_size) === result.rows.length,
      ),
    ).toBe(true);
    expect(result.truncated).toBe(false);
  });
  it("describes SQL columns independently of empty rows or null values", async () => {
    const empty = await runReportingQuery(
      "select 1::integer as amount where false",
    );
    const nullable = await runReportingQuery("select null::integer as amount");
    expect(empty.rows).toEqual([]);
    expect(empty.columns).toEqual([{ name: "amount", postgresTypeOid: 23 }]);
    expect(nullable.columns).toEqual(empty.columns);
  });
  it("preserves exact large integers and decimals", async () => {
    const result = await runReportingQuery(
      "select '9007199254740993'::bigint as large, '123.456789012345678901'::numeric as precise",
    );
    expect(result.rows[0]).toEqual({
      large: "9007199254740993",
      precise: "123.456789012345678901",
    });
  });
  it("rejects an oversized aggregate before transporting its content", async () => {
    const literal = "x".repeat(16000);
    const result = await runReportingQuery(
      `select string_agg('${literal}', '') as oversized from admin_reporting.students a cross join admin_reporting.students b`,
    );
    expect(result.rows).toEqual([]);
    expect(result.truncated).toBe(true);
  });
  it("explicitly reports truncation and retains a clean connection after a query error", async () => {
    const result = await runReportingQuery(
      "select * from admin_reporting.students",
      1,
    );
    expect(result.rows.length).toBeLessThanOrEqual(1);
    expect(typeof result.truncated).toBe("boolean");
    await expect(
      runReportingQuery("select missing_column from admin_reporting.students"),
    ).rejects.toThrow("Reporting query failed");
    expect(
      (await runReportingQuery("select 42 as answer")).rows[0].answer,
    ).toBe(42);
  });
});
