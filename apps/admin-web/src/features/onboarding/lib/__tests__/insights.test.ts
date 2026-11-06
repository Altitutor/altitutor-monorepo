import { enquiryFunnel } from "../insights";
import { journey } from "../../__tests__/fixtures";

it("counts identified siblings separately and keeps unresolved families and historical journeys outside the baseline", () => {
  const date = "2026-11-05T14:00:00Z"; // 6 November in Adelaide.
  const riley = journey("riley");
  const casey = journey("casey");
  const rows = [
    { ...journey("family", null), enquiry_at: date },
    { ...riley, enquiry_at: date, evidence: { ...riley.evidence, trial_booked_at: date } },
    { ...casey, enquiry_at: date, evidence: { ...casey.evidence, trial_booked_at: date, trial_attended_at: date, converted_at: date } },
    { ...journey("historical"), enquiry_at: null, historical: true },
    { ...journey("returning"), enquiry_at: date, is_returning: true },
    { ...journey("old"), enquiry_at: "2026-11-04T04:00:00Z" },
  ];
  const range = { from: "2026-11-06", to: "2026-11-06" };
  expect(enquiryFunnel(rows, range, "new")).toEqual({
    counts: [2, 2, 1, 0, 0, 0, 1],
    unresolvedFamilies: 1,
    unknownEnquiryDates: 0,
  });
  expect(enquiryFunnel(rows, range, "returning").counts[0]).toBe(1);
  expect(enquiryFunnel(rows, range, "historical").unknownEnquiryDates).toBe(1);
});
