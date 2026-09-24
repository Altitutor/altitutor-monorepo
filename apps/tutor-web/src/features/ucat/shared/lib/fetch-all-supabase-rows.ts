const SUPABASE_PAGE_SIZE = 1000

type SupabasePageResult<Row> = {
  data: Row[] | null
  error: unknown
}

/**
 * Supabase projects commonly cap Data API responses at 1,000 rows. Catalogs
 * that filter and paginate in the browser must therefore fetch in ranges.
 */
export async function fetchAllSupabaseRows<Row>(
  fetchPage: (from: number, to: number) => PromiseLike<SupabasePageResult<Row>>,
): Promise<Row[]> {
  const rows: Row[] = []

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + SUPABASE_PAGE_SIZE - 1)
    if (error) throw error

    const page = data ?? []
    rows.push(...page)
    if (page.length < SUPABASE_PAGE_SIZE) return rows
  }
}
