import {
  tutorToolbarClassName,
  tutorToolbarControlClassName,
  tutorToolbarRowClassName,
  tutorToolbarSearchContainerClassName,
  tutorToolbarSearchInputClassName,
} from '@/shared/lib/tutor-visual'

export const ucatCatalogToolbarClassName = tutorToolbarClassName

export const ucatCatalogToolbarRowClassName = tutorToolbarRowClassName

export const ucatCatalogToolbarSearchContainerClassName = tutorToolbarSearchContainerClassName

export const ucatCatalogToolbarSearchInputClassName = tutorToolbarSearchInputClassName

export const ucatCatalogToolbarControlClassName = tutorToolbarControlClassName

export function hasCatalogToolbarRefinements({
  search,
  searchScopes,
  defaultSearchScopes,
  filters,
}: {
  search: string
  searchScopes: string[]
  defaultSearchScopes: string[]
  filters: Record<string, unknown[]>
}): boolean {
  if (search.trim().length > 0) return true

  const scopesMatchDefaults =
    searchScopes.length === defaultSearchScopes.length &&
    defaultSearchScopes.every((scope) => searchScopes.includes(scope))

  if (!scopesMatchDefaults) return true

  return Object.values(filters).some((values) => Array.isArray(values) && values.length > 0)
}
