/** Read a filtered list in bounded pages before applying a derived sort or filter. */
export async function collectTableRows<T>(
  fetchPage: (offset: number, limit: number) => Promise<{ rows: T[]; total: number }>,
) {
  const size = 200;
  const rows: T[] = [];
  for (let offset = 0; ; offset += size) {
    const result = await fetchPage(offset, size);
    rows.push(...result.rows);
    if (offset + size >= result.total) return rows;
  }
}
