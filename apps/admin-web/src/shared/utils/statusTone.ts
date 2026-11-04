const GREEN = "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200";
const RED = "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
const GREY = "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
const ORANGE = "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200";

const TONES: Record<string, string> = {
  active: GREEN,
  trial: ORANGE,
  inactive: GREY,
  discontinued: RED,
  cancelled: RED,
  canceled: RED,
  failed: RED,
  full: ORANGE,
  completed: GREEN,
  scheduled: GREEN,
  confirmed: GREEN,
  sent: GREEN,
  draft: GREY,
  open: GREEN,
  closed: GREY,
  snoozed: ORANGE,
};

/** One status colour map for chips, calendar hovers, and other status badges. */
export function statusToneClass(status: string): string {
  const key = status.trim().toLowerCase().replace(/[_-]+/g, "");
  return TONES[key] ?? GREY;
}

export function statusLabel(status: string): string {
  return status
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Planned attendance is green when the person is expected, red when they are not. */
export function plannedAttendanceTone(status: string): "attending" | "absent" {
  const key = status.toLowerCase();
  if (key.includes("absent") || key.includes("unplanned")) return "absent";
  return "attending";
}

export function plannedAttendanceClass(tone: "attending" | "absent"): string {
  return tone === "absent"
    ? "text-red-600 dark:text-red-400"
    : "text-green-600 dark:text-green-400";
}
