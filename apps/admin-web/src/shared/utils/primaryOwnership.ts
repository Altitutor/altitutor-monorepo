/** Only single-owner relationships retain a breadcrumb trail. */
const ownedRoutes: Record<string, readonly string[]> = {
  classes: ["sessions"],
  students: ["invoices"],
  subjects: ["topics"],
  topics: ["topics"],
};
function record(path: string) {
  const parts = path.split("/").filter(Boolean);
  const route = parts.at(-2),
    id = parts.at(-1);
  return route && id && /^[a-f0-9-]{36}$/i.test(id)
    ? { route, id, path: `/${route}/${id}` }
    : null;
}
export function primaryTrail(
  pathname: string,
  query: URLSearchParams,
): string[] {
  try {
    const saved: unknown = JSON.parse(query.get("trail") ?? "[]");
    if (
      !Array.isArray(saved) ||
      saved.length > 10 ||
      !saved.every((path) => typeof path === "string" && record(path))
    )
      return [];
    const paths = [...saved, pathname];
    return paths.every(
      (path, index) =>
        index === 0 ||
        ownedRoutes[record(paths[index - 1])!.route]?.includes(
          record(path)?.route ?? "",
        ),
    )
      ? saved
      : [];
  } catch {
    return [];
  }
}
export function ownedPrimaryHref(
  href: string,
  pathname: string,
  query: URLSearchParams,
) {
  const target = new URL(href, "http://admin.local");
  const source = record(pathname),
    next = record(target.pathname);
  if (
    !source ||
    !next ||
    source.path === next.path ||
    !ownedRoutes[source.route]?.includes(next.route)
  )
    return href;
  const trail = [...primaryTrail(pathname, query), source.path];
  target.searchParams.set("trail", JSON.stringify(trail));
  return `${target.pathname}?${target.searchParams}`;
}
