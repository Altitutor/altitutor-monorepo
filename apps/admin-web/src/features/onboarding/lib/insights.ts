import { nextActions, type Journey } from "./model";
function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}
function elapsed(from: string | null, to: string | null | undefined) {
  if (!from || !to) return null;
  const days = (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000;
  return days >= 0 ? days : null;
}
export function actionInsights(
  journeys: Journey[],
  deadlines: Record<string, number>,
  cadence: number[],
) {
  const definitions = [
    {
      key: "book_trial",
      label: "Book trial",
      duration: (j: Journey) =>
        elapsed(j.enquiry_at, j.evidence.trial_booked_at),
    },
    {
      key: "registration_link",
      label: "Send registration link",
      duration: (j: Journey) =>
        elapsed(j.evidence.trial_attended_at, j.evidence.registration_link_at),
    },
    {
      key: "enrol",
      label: "Place all agreed subjects",
      duration: (j: Journey) =>
        j.evidence.subjects.length &&
        j.evidence.subjects.every((s) =>
          j.evidence.classes.some((c) => c.subject_id === s.id),
        )
          ? elapsed(
              j.evidence.registered_at,
              j.evidence.classes
                .flatMap((c) => (c.added_at ? [c.added_at] : []))
                .sort()
                .at(-1),
            )
          : null,
    },
  ];
  const pending = journeys.flatMap((j) =>
    nextActions(j, deadlines, new Date(), cadence),
  );
  return definitions.map((d) => {
    const values = journeys.flatMap((j) => {
      const v = d.duration(j);
      return v === null ? [] : [v];
    });
    return {
      key: d.key,
      label: d.label,
      completed: values.length,
      medianDays: median(values),
      open: pending.filter((a) => a.key === d.key).length,
      overdue: pending.filter((a) => a.key === d.key && a.overdue).length,
    };
  });
}
