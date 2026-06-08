export const UPGRADE_SEARCH_PARAM = "upgrade";
export const IN_PERSON_SEARCH_PARAM = "inPerson";

export function hasTruthySearchParam(
  params: URLSearchParams,
  key: string,
): boolean {
  const value = params.get(key);
  return value === "1" || value === "true";
}

export function stripUpsellSearchParams(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  next.delete(UPGRADE_SEARCH_PARAM);
  next.delete(IN_PERSON_SEARCH_PARAM);
  return next;
}
