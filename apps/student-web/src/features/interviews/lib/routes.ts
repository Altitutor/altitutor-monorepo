/** Waiting and live use the same guarded, full-viewport route. Results keep portal navigation. */
export function isStudentInterviewRoom(pathname: string): boolean {
  return /^\/interviews\/rounds\/[^/]+\/?$/.test(pathname);
}

export function interviewRoomHref(roundId: string): string {
  return `/interviews/rounds/${encodeURIComponent(roundId)}`;
}

export function interviewResultsHref(roundId: string): string {
  return `${interviewRoomHref(roundId)}/results`;
}
