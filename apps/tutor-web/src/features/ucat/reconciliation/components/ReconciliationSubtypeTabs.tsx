import Link from 'next/link'
import { cn } from '@/shared/utils'

export function ReconciliationSubtypeTabs<TSlug extends string>({
  items,
  activeSlug,
  baseHref,
  label,
}: {
  items: ReadonlyArray<{ slug: TSlug; tabLabel: string }>
  activeSlug: TSlug
  baseHref: string
  label: string
}) {
  return (
    <nav aria-label={label} className="overflow-x-auto pb-1">
      <div className="flex min-w-max gap-1 rounded-xl border bg-muted/40 p-1">
        {items.map((item) => {
          const isActive = item.slug === activeSlug
          return (
            <Link
              key={item.slug}
              href={`${baseHref}/${item.slug}`}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
              )}
            >
              {item.tabLabel}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
