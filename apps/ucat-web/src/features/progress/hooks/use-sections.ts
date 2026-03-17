import { useQuery } from '@tanstack/react-query'
import type { SectionRow } from '@/app/api/ucat/sections/route'

async function fetchSections(): Promise<SectionRow[]> {
  const res = await fetch('/api/ucat/sections')
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to fetch sections')
  }
  return res.json()
}

export function useSections() {
  return useQuery({
    queryKey: ['ucat', 'sections'],
    queryFn: fetchSections,
  })
}
