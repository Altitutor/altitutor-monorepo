import {
  buildFutureInvoicePreviews,
  type FutureSessionAssignment,
} from "../future-invoices";

function assignment({
  id,
  subjectId,
  subjectName,
  sessionName,
  startAt,
}: {
  id: string;
  subjectId: string;
  subjectName: string;
  sessionName?: string;
  startAt: string;
}): FutureSessionAssignment {
  const endAt = new Date(new Date(startAt).getTime() + 60 * 60 * 1000);
  return {
    id,
    session: {
      id: `session-${id}`,
      start_at: startAt,
      end_at: endAt.toISOString(),
      subject_id: subjectId,
      billing_type: "CLASS",
      long_name: sessionName ?? null,
      subject: {
        id: subjectId,
        name: subjectName,
        long_name: subjectName,
        short_name: null,
      },
    },
  };
}

describe("buildFutureInvoicePreviews", () => {
  it("returns the next invoice per subject newest first while allocating credit chronologically", () => {
    const assignments = [
      assignment({
        id: "math-1",
        subjectId: "math",
        subjectName: "Mathematics",
        startAt: "2026-10-01T00:00:00.000Z",
      }),
      assignment({
        id: "math-2",
        subjectId: "math",
        subjectName: "Mathematics",
        startAt: "2026-10-02T00:00:00.000Z",
      }),
      assignment({
        id: "english-1",
        subjectId: "english",
        subjectName: "English",
        sessionName: "English A - Saturday, 3 October 2026, 10:30 am",
        startAt: "2026-10-03T00:00:00.000Z",
      }),
    ];

    const previews = buildFutureInvoicePreviews({
      assignments,
      chargeableIds: new Set(assignments.map(({ id }) => id)),
      invoicedIds: new Set(),
      adjustmentControlledIds: new Set(),
      pricing: [
        { billing_type: "CLASS", hourly_rate_cents: 10_000, currency: "AUD" },
      ],
      pricingOverrides: [],
      subsidies: [
        {
          student_id: "student-1",
          subject_id: "math",
          billing_type: "CLASS",
          price_cents: 8_000,
          currency: "AUD",
          effective_from: "2026-01-01T00:00:00.000Z",
          effective_until: null,
        },
      ],
      studentId: "student-1",
    });

    expect(previews).toHaveLength(2);
    expect(previews[0]).toMatchObject({
      sessions_students_id: "english-1",
      session_name: "English A - Saturday, 3 October 2026, 10:30 am",
      full_amount_cents: 10_000,
      prior_charge_cents: 16_000,
      is_first_in_currency: false,
    });
    expect(previews[1]).toMatchObject({
      sessions_students_id: "math-1",
      full_amount_cents: 8_000,
      prior_charge_cents: 0,
      is_first_in_currency: true,
    });
  });

  it("excludes assignments that are not chargeable or are already controlled", () => {
    const assignments = [
      assignment({
        id: "not-chargeable",
        subjectId: "math",
        subjectName: "Mathematics",
        startAt: "2026-10-01T00:00:00.000Z",
      }),
      assignment({
        id: "invoiced",
        subjectId: "english",
        subjectName: "English",
        startAt: "2026-10-02T00:00:00.000Z",
      }),
      assignment({
        id: "adjustment",
        subjectId: "science",
        subjectName: "Science",
        startAt: "2026-10-03T00:00:00.000Z",
      }),
    ];

    expect(
      buildFutureInvoicePreviews({
        assignments,
        chargeableIds: new Set(["invoiced", "adjustment"]),
        invoicedIds: new Set(["invoiced"]),
        adjustmentControlledIds: new Set(["adjustment"]),
        pricing: [
          { billing_type: "CLASS", hourly_rate_cents: 10_000, currency: "AUD" },
        ],
        pricingOverrides: [],
        subsidies: [],
        studentId: "student-1",
      }),
    ).toEqual([]);
  });
});
