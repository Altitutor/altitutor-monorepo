import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

type UcatPageHeaderProps = {
  title: string
  description?: string
  backHref?: string
  backLabel?: string
}

export function UcatPageHeader({ title, description, backHref, backLabel }: UcatPageHeaderProps) {
  return (
    <div className="flex items-start gap-3">
      {backHref ? (
        <Link
          href={backHref}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={backLabel ?? 'Go back'}
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
      ) : null}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  )
}
