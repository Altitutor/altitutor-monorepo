import type { StudentDirectoryEntry } from '../types/directory';

export function studentGroup(
  entry: StudentDirectoryEntry,
  group: string | null,
) {
  if (group === "stage") return entry.stage ?? "No onboarding";
  if (group === "status") return entry.student?.status ?? "No in-person status";
  if (group === "curriculum")
    return entry.student?.curriculum ?? "No curriculum";
  if (group === "year_level")
    return entry.student?.year_level
      ? `Year ${entry.student.year_level}`
      : "No year level";
  if (group === "account_class")
    return entry.student?.account_class ?? "Enquiries";
  return "Students";
}
