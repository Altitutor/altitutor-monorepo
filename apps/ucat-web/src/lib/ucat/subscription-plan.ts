export type UcatCheckoutPlan = "weekly" | "monthly";

export function isUcatCheckoutPlan(value: unknown): value is UcatCheckoutPlan {
  return value === "weekly" || value === "monthly";
}
