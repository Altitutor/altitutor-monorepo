export async function mergeRequest<T>(
  input: Record<string, unknown>,
): Promise<T> {
  const response = await fetch("/api/student-merges", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "The request failed");
  return data as T;
}
export async function mergeRead<T>(
  query = "",
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/student-merges${query}`, {
    cache: "no-store",
    signal,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load students");
  return data as T;
}
