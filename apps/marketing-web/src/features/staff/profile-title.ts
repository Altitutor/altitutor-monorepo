/** Remove legacy teaching lists without losing course-manager or admin titles. */
export function profileTitle(
  title: string,
  administrativeStaff = false,
): string {
  const cleaned = title.replace(/\s*Tutor\s*:[\s\S]*$/i, "").trim();
  return administrativeStaff && !/administrative staff/i.test(cleaned)
    ? [cleaned, "Administrative staff"].filter(Boolean).join("\n")
    : cleaned;
}
