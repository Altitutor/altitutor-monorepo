import type { DataTableState } from '@altitutor/shared'

/** Params owned by other UCAT page features — never removed when syncing table state. */
export const UCAT_TABLE_URL_RESERVED_PARAMS = ['tab', 'edit', 'mode', 'days', 'filter'] as const

const FILTER_PARAM_PREFIX = 'f.'

export type ParseUcatTableUrlStateOptions = {
  initialVisibleColumns: string[]
  defaultFilters?: Record<string, unknown[]>
  defaultPageSize?: number
  /** Prefix table params, e.g. `stems` → `stems.q`, `stems.f.section_id` */
  paramPrefix?: string
  /** When set, only these column keys are restored from `cols`. */
  availableColumns?: string[]
}

export type WriteUcatTableUrlStateOptions = {
  paramPrefix?: string
  defaultPageSize?: number
  reservedParams?: readonly string[]
}

export type UcatTableUrlShowDeletedOptions = {
  paramPrefix?: string
  /** URL key for show-deleted toggle; defaults to `deleted` (or `{prefix}.deleted`). */
  paramKey?: string
}

function prefixedKey(key: string, prefix?: string): string {
  return prefix ? `${prefix}.${key}` : key
}

function filterParamKey(filterKey: string, prefix?: string): string {
  return prefixedKey(`${FILTER_PARAM_PREFIX}${filterKey}`, prefix)
}

function parseFilterParamKey(paramKey: string, prefix?: string): string | null {
  const fullPrefix = prefix ? `${prefix}.${FILTER_PARAM_PREFIX}` : FILTER_PARAM_PREFIX
  if (!paramKey.startsWith(fullPrefix)) return null
  return paramKey.slice(fullPrefix.length)
}

/** Multi-value filters are comma-separated in a single query param (`f.{key}=a,b,c`). */
function splitFilterValues(raw: string): string[] {
  if (!raw) return []
  return raw.split(',').map((v) => v.trim()).filter(Boolean)
}

function isTableOwnedParam(key: string, prefix?: string): boolean {
  if (prefix) {
    if (!key.startsWith(`${prefix}.`)) return false
    const suffix = key.slice(prefix.length + 1)
    return (
      suffix === 'q' ||
      suffix === 'sort' ||
      suffix === 'sortDir' ||
      suffix === 'page' ||
      suffix === 'pageSize' ||
      suffix === 'cols' ||
      suffix === 'groupBy' ||
      suffix === 'deleted' ||
      suffix.startsWith(FILTER_PARAM_PREFIX)
    )
  }
  return (
    key === 'q' ||
    key === 'sort' ||
    key === 'sortDir' ||
    key === 'page' ||
    key === 'pageSize' ||
    key === 'cols' ||
    key === 'groupBy' ||
    key === 'deleted' ||
    key.startsWith(FILTER_PARAM_PREFIX)
  )
}

export function parseShowDeletedFromUrl(
  searchParams: URLSearchParams,
  options?: UcatTableUrlShowDeletedOptions,
): boolean {
  const key = options?.paramKey ?? prefixedKey('deleted', options?.paramPrefix)
  return searchParams.get(key) === '1'
}

export function writeShowDeletedToUrl(
  params: URLSearchParams,
  showDeleted: boolean,
  options?: UcatTableUrlShowDeletedOptions,
): void {
  const key = options?.paramKey ?? prefixedKey('deleted', options?.paramPrefix)
  if (showDeleted) params.set(key, '1')
  else params.delete(key)
}

export function parseUcatTableStateFromUrl(
  searchParams: URLSearchParams,
  options: ParseUcatTableUrlStateOptions,
): DataTableState {
  const {
    initialVisibleColumns,
    defaultFilters = {},
    defaultPageSize = 20,
    paramPrefix,
    availableColumns,
  } = options

  const allowedColumnSet = new Set(availableColumns ?? initialVisibleColumns)
  const colsRaw = searchParams.get(prefixedKey('cols', paramPrefix))
  const visibleColumns = colsRaw
    ? colsRaw.split(',').map((c) => c.trim()).filter((c) => allowedColumnSet.has(c))
    : []
  const resolvedVisibleColumns = visibleColumns.length > 0 ? visibleColumns : initialVisibleColumns

  const filters: Record<string, unknown[]> = { ...defaultFilters }
  for (const [paramKey, value] of searchParams.entries()) {
    const filterKey = parseFilterParamKey(paramKey, paramPrefix)
    if (!filterKey || !value) continue
    const values = splitFilterValues(value)
    if (values.length > 0) filters[filterKey] = values
  }

  const sortByRaw = searchParams.get(prefixedKey('sort', paramPrefix))
  const sortBy = sortByRaw && sortByRaw.length > 0 ? sortByRaw : null

  const sortDirRaw = searchParams.get(prefixedKey('sortDir', paramPrefix))
  const sortDirection: 'asc' | 'desc' = sortDirRaw === 'asc' ? 'asc' : 'desc'

  const pageRaw = Number(searchParams.get(prefixedKey('page', paramPrefix)))
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1

  const pageSizeRaw = Number(searchParams.get(prefixedKey('pageSize', paramPrefix)))
  const pageSize =
    Number.isFinite(pageSizeRaw) && pageSizeRaw >= 1 ? Math.floor(pageSizeRaw) : defaultPageSize

  const groupByRaw = searchParams.get(prefixedKey('groupBy', paramPrefix))
  const groupBy = groupByRaw && groupByRaw.length > 0 ? groupByRaw : null

  return {
    search: searchParams.get(prefixedKey('q', paramPrefix)) ?? '',
    filters,
    sortBy,
    sortDirection,
    groupBy,
    page,
    pageSize,
    visibleColumns: resolvedVisibleColumns,
  }
}

export function writeUcatTableStateToUrl(
  params: URLSearchParams,
  state: DataTableState,
  options?: WriteUcatTableUrlStateOptions,
): void {
  const { paramPrefix, defaultPageSize = 20, reservedParams = UCAT_TABLE_URL_RESERVED_PARAMS } = options ?? {}
  const reserved = new Set(reservedParams)

  for (const key of [...params.keys()]) {
    if (reserved.has(key)) continue
    if (isTableOwnedParam(key, paramPrefix)) params.delete(key)
  }

  const q = state.search.trim()
  if (q) params.set(prefixedKey('q', paramPrefix), q)

  if (state.sortBy) params.set(prefixedKey('sort', paramPrefix), state.sortBy)
  if (state.sortDirection !== 'desc') params.set(prefixedKey('sortDir', paramPrefix), state.sortDirection)

  if (state.page > 1) params.set(prefixedKey('page', paramPrefix), String(state.page))
  if (state.pageSize !== defaultPageSize) {
    params.set(prefixedKey('pageSize', paramPrefix), String(state.pageSize))
  }

  if (state.groupBy) params.set(prefixedKey('groupBy', paramPrefix), state.groupBy)

  if (state.visibleColumns.length > 0) {
    params.set(prefixedKey('cols', paramPrefix), state.visibleColumns.join(','))
  }

  for (const [filterKey, values] of Object.entries(state.filters)) {
    if (!Array.isArray(values) || values.length === 0) continue
    const serialized = values.map(String).filter(Boolean).join(',')
    if (serialized) params.set(filterParamKey(filterKey, paramPrefix), serialized)
  }
}

export function clearUcatTableUrlParams(
  params: URLSearchParams,
  options?: { paramPrefix?: string; reservedParams?: readonly string[] },
): void {
  const { paramPrefix, reservedParams = UCAT_TABLE_URL_RESERVED_PARAMS } = options ?? {}
  const reserved = new Set(reservedParams)
  for (const key of [...params.keys()]) {
    if (reserved.has(key)) continue
    if (isTableOwnedParam(key, paramPrefix)) params.delete(key)
  }
}

export function isUcatTableStateEqual(a: DataTableState, b: DataTableState): boolean {
  if (
    a.search !== b.search ||
    a.sortBy !== b.sortBy ||
    a.sortDirection !== b.sortDirection ||
    a.groupBy !== b.groupBy ||
    a.page !== b.page ||
    a.pageSize !== b.pageSize
  ) {
    return false
  }

  if (
    a.visibleColumns.length !== b.visibleColumns.length ||
    !a.visibleColumns.every((column, index) => column === b.visibleColumns[index])
  ) {
    return false
  }

  const aKeys = Object.keys(a.filters).sort()
  const bKeys = Object.keys(b.filters).sort()
  if (aKeys.length !== bKeys.length) return false

  for (let index = 0; index < aKeys.length; index += 1) {
    const key = aKeys[index]
    if (key !== bKeys[index]) return false
    const aValues = a.filters[key]
    const bValues = b.filters[key]
    if (!Array.isArray(aValues) || !Array.isArray(bValues)) return false
    if (aValues.length !== bValues.length) return false
    if (!aValues.every((value, valueIndex) => String(value) === String(bValues[valueIndex]))) {
      return false
    }
  }

  return true
}
