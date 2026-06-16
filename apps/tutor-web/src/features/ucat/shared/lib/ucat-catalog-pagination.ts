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

export type CatalogPageNumberItem = number | 'ellipsis'

export function getTruncatedPageNumbers(
  currentPage: number,
  pageCount: number,
  maxVisiblePages = 5,
): CatalogPageNumberItem[] {
  if (pageCount <= maxVisiblePages) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  const pages: CatalogPageNumberItem[] = []
  const showLeftEllipsis = currentPage > 3
  const showRightEllipsis = currentPage < pageCount - 2

  const addRange = (start: number, end: number) => {
    for (let index = start; index <= end; index += 1) {
      pages.push(index)
    }
  }

  pages.push(1)
  if (showLeftEllipsis) {
    pages.push('ellipsis')
  }

  const start = showLeftEllipsis ? currentPage - 1 : 2
  const end = showRightEllipsis ? currentPage + 1 : pageCount - 1
  addRange(start, end)

  if (showRightEllipsis) {
    pages.push('ellipsis')
  }
  pages.push(pageCount)

  return pages
}
