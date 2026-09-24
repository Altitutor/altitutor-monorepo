'use client'

import { tutorCardCn } from '@/shared/lib/tutor-visual'
import type { SetQuestionDistributionRow } from '@/features/ucat/sets/lib/set-question-distribution'

export function UcatSetDistributionList({ rows }: { rows: SetQuestionDistributionRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No data available.</p>
  }

  return (
    <ul className="-mx-3 -mb-4 divide-y">
      {rows.map((row) => (
        <li key={row.label} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <span className="min-w-0 truncate" title={row.label}>{row.label}</span>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums">
            {row.count}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function UcatSetDistributionCard({
  title,
  rows,
}: {
  title: string
  rows: SetQuestionDistributionRow[]
}) {
  return (
    <section className={tutorCardCn('overflow-hidden p-0')}>
      <h3 className="border-b px-3 py-2 text-sm font-semibold">{title}</h3>
      {rows.length > 0 ? (
        <ul className="divide-y">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 truncate" title={row.label}>{row.label}</span>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums">
                {row.count}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-3 py-4 text-sm text-muted-foreground">No data available.</p>
      )}
    </section>
  )
}
