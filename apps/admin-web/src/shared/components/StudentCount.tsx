export function StudentCount({
  count,
  attendance,
}: {
  count: number | undefined;
  attendance?: { count: number | undefined; label: "attending" | "attended" };
}) {
  if (count === undefined) return null;
  return (
    <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
      {attendance ? (
        <span title={attendance.count === undefined ? "Attendance has not been recorded" : undefined}>
          {attendance.count ?? "—"}/{count} {attendance.label}
        </span>
      ) : (
        <>{count} {count === 1 ? "student" : "students"}</>
      )}
    </span>
  );
}
