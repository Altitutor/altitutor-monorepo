export interface RecipientInterview {
  id: string;
  name: string;
  studentIds: string[];
}
export function interviewRecipients<
  T extends { id: string; first_name: string | null; last_name: string | null },
>(
  students: T[],
  rounds: RecipientInterview[],
  sort: "selected" | "name" | "interview",
) {
  const entries = students.map((student) => ({
    student,
    group:
      [
        ...new Set(
          rounds
            .filter((round) => round.studentIds.includes(student.id))
            .map((round) => round.name),
        ),
      ]
        .sort((a, b) => a.localeCompare(b))
        .join(" · ") || "No interview",
  }));
  if (sort === "selected") return entries;
  return entries.sort((a, b) => {
    if (sort === "interview" && a.group !== b.group) {
      if (a.group === "No interview") return 1;
      if (b.group === "No interview") return -1;
      return a.group.localeCompare(b.group);
    }
    return `${a.student.first_name ?? ""} ${a.student.last_name ?? ""}`.localeCompare(
      `${b.student.first_name ?? ""} ${b.student.last_name ?? ""}`,
    );
  });
}
