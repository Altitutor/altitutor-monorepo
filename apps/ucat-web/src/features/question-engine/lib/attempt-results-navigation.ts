type ResultsLocation = Pick<Location, "assign">;

export function navigateToAttemptResults(
  href: string,
  location: ResultsLocation = window.location,
): void {
  location.assign(href);
}
