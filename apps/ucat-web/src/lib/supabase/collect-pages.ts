type PageError = { message: string };

export type PageResult<Row> = {
  data: Row[] | null;
  error: PageError | null;
};

/**
 * Collect a PostgREST relation without silently accepting the project-wide
 * maximum-row cap. Pages are intentionally sequential so one logical read does
 * not create its own connection burst.
 */
export async function collectPages<Row>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<Row>>,
  pageSize = 1_000,
): Promise<Row[]> {
  const rows: Row[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export async function collectPagedResult<Row>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<Row>>,
  pageSize = 1_000,
): Promise<PageResult<Row>> {
  try {
    return { data: await collectPages(fetchPage, pageSize), error: null };
  } catch (error) {
    return {
      data: null,
      error:
        error && typeof error === "object" && "message" in error
          ? { message: String(error.message) }
          : { message: "Failed to load a paginated Supabase relation" },
    };
  }
}
