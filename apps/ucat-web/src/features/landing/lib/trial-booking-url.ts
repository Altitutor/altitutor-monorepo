/**
 * In-person trial booking on the student portal (env-aware).
 */
export function getTrialBookingUrl(): string {
  const base =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_STUDENT_URL
      ? process.env.NEXT_PUBLIC_STUDENT_URL
      : process.env.NODE_ENV === "development"
        ? "http://localhost:3001"
        : "https://student.altitutor.com";
  return `${base.replace(/\/$/, "")}/booking/trial-session`;
}
