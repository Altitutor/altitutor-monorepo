export function learningModuleHref(
  moduleId: string,
  sectionNumber: number | null | undefined,
): string {
  const encodedId = encodeURIComponent(moduleId);
  if (sectionNumber != null && sectionNumber >= 1 && sectionNumber <= 4) {
    return `/learn/sections/${sectionNumber}/${encodedId}`;
  }
  return `/learn/${encodedId}`;
}
