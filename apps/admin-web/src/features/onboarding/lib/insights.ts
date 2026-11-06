import { utcToAdelaideDate } from "@/features/bookings/utils/dateTimeHelpers";
import { stages, type Journey } from "./model";

export const funnelStages = [
  stages[0],
  stages[1],
  stages[2],
  "Registration link sent",
  stages[4],
  stages[5],
  "Paid and attended",
] as const;

export type EnquiryCohort = "new" | "returning" | "historical";

export function enquiryFunnel(
  journeys: Journey[],
  range: { from: string; to: string },
  cohort: EnquiryCohort,
) {
  const counts = funnelStages.map(() => 0);
  let unresolvedFamilies = 0;
  let unknownEnquiryDates = 0;

  for (const journey of journeys) {
    if (!journey.enquiry_at) {
      if (cohort === "historical" && journey.historical) unknownEnquiryDates += 1;
      continue;
    }
    const day = utcToAdelaideDate(journey.enquiry_at);
    if (day < range.from || day > range.to) continue;
    if (!journey.student_id) {
      if (cohort === "new" && !journey.historical && !journey.closed_at) unresolvedFamilies += 1;
      continue;
    }
    const kind = journey.historical ? "historical" : journey.is_returning ? "returning" : "new";
    if (kind !== cohort) continue;

    const evidence = journey.evidence;
    [
      true,
      evidence.trial_booked_at,
      evidence.trial_attended_at,
      evidence.registration_link_at,
      evidence.registered_at,
      evidence.classes.length,
      evidence.converted_at,
    ].forEach((reached, index) => {
      if (reached) counts[index] += 1;
    });
  }
  return { counts, unresolvedFamilies, unknownEnquiryDates };
}
