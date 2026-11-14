/** A roster total, independent of attendance and name visibility. */
export function StudentCount({ count }: { count: number | undefined }) {
  if (count === undefined) return null;
  return (
    <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
      {count} {count === 1 ? "student" : "students"}
    </span>
  );
}
