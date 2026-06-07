import type { PracticeDiscountDashboardStatus } from "@/lib/ucat/practice-day-discount-dashboard";

export type PracticeDiscountProgress = PracticeDiscountDashboardStatus;

export async function fetchPracticeDiscountProgress(): Promise<PracticeDiscountProgress | null> {
  try {
    const res = await fetch("/api/ucat/subscription/practice-discount-progress", {
      method: "GET",
      credentials: "same-origin",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as PracticeDiscountDashboardStatus;
    if (typeof data.earned !== "number" || typeof data.cap !== "number") {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}
