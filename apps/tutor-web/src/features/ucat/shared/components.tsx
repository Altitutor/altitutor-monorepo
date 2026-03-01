'use client'

import Link from 'next/link'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { Button, Skeleton } from '@altitutor/ui'
import { cn } from '@/shared/utils'

export function UcatAccessDenied() {
  return (
    <div className="rounded-lg border border-border bg-card p-8 text-center">
      <h2 className="text-xl font-semibold">UCAT Access Required</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Your tutor account is not currently assigned to a UCAT class.
      </p>
      <div className="mt-4">
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    </div>
  )
}

export type UcatBreadcrumbItem = {
  label: string
  href?: string
}

export function UcatBreadcrumb({ items, className }: { items: UcatBreadcrumbItem[]; className?: string }) {
  if (items.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className={cn('mb-4 flex items-center gap-2 text-sm text-muted-foreground', className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1

        return (
          <div key={`${item.label}-${index}`} className="flex items-center gap-2">
            {item.href && !isLast ? (
              <Link href={item.href} className="transition-colors hover:text-foreground">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'font-medium text-foreground' : ''}>{item.label}</span>
            )}
            {!isLast ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : null}
          </div>
        )
      })}
    </nav>
  )
}

export function UcatPageHeader({
  title,
  description,
  actions,
  backHref,
  backLabel,
  breadcrumbs,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  backHref?: string
  backLabel?: string
  breadcrumbs?: UcatBreadcrumbItem[]
}) {
  return (
    <>
      {breadcrumbs ? <UcatBreadcrumb items={breadcrumbs} /> : null}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {backHref ? (
            <Button asChild variant="outline" size="icon" className="mt-1">
              <Link href={backHref} aria-label={backLabel ?? 'Back'}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          ) : null}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            {description ? <p className="mt-1 text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </>
  )
}

export function UcatPageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="p-6 space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid gap-2 md:grid-cols-4">
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
      </div>
      <div className="rounded border p-4 space-y-3">
        {Array.from({ length: rows }).map((_, idx) => (
          <Skeleton key={idx} className="h-8 w-full" />
        ))}
      </div>
    </div>
  )
}
