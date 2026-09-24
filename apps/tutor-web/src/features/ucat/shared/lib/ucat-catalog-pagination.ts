export function paginateCatalogItems<T>(items: T[], page: number, pageSize: number) {
  const total = items.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const effectivePage = Math.min(Math.max(page, 1), pageCount)
  const start = (effectivePage - 1) * pageSize

  return {
    items: items.slice(start, start + pageSize),
    total,
    pageCount,
    effectivePage,
  }
}
