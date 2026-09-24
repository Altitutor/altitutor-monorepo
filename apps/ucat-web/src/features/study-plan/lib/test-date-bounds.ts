import { todayIso } from "@/features/study-plan/lib/dates";

export function testDateBounds(
  testYear: number,
  today: string = todayIso(),
): { minDate: string; maxDate: string } {
  const yearStart = `${testYear}-01-01`;
  const yearEnd = `${testYear}-12-31`;
  const minDate = today > yearStart ? today : yearStart;
  return { minDate, maxDate: yearEnd };
}

export function isTestDateInBounds(
  testDate: string,
  testYear: number,
  today: string = todayIso(),
): boolean {
  if (Number(testDate.slice(0, 4)) !== testYear) return false;
  const { minDate, maxDate } = testDateBounds(testYear, today);
  return testDate >= minDate && testDate <= maxDate;
}
