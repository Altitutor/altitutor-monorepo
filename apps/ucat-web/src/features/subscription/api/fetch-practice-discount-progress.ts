export type PracticeDiscountProgress = {
  earned: number;
  cap: number;
  discountPerDayCents: number;
  billingInterval: string;
};

export async function fetchPracticeDiscountProgress(): Promise<PracticeDiscountProgress | null> {
  try {
    const res = await fetch("/api/ucat/subscription/practice-discount-progress", {
      method: "GET",
      credentials: "same-origin",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as PracticeDiscountProgress;
    if (typeof data.earned !== "number" || typeof data.cap !== "number") {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}
