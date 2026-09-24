'use client'

import { useRouter } from 'next/navigation'
import { SegmentedControl } from '@/shared/components/segmented-control'

export function ReconciliationSubtypeTabs<TSlug extends string>({
  items,
  activeSlug,
  baseHref,
  label,
  counts,
}: {
  items: ReadonlyArray<{ slug: TSlug; tabLabel: string }>
  activeSlug: TSlug
  baseHref: string
  label: string
  counts?: Partial<Record<TSlug, number>>
}) {
  const router = useRouter()

  return (
    <SegmentedControl
      className="w-fit max-w-full"
      value={activeSlug}
      onValueChange={(slug) => {
        router.push(`${baseHref}/${slug}`)
      }}
      aria-label={label}
      options={items.map((item) => ({
        value: item.slug,
        label: item.tabLabel,
        badge: counts?.[item.slug],
      }))}
    />
  )
}
