import type { ReactNode } from 'react'

export function UcatPagePlaceholder({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <section className="space-y-3 rounded-xl bg-card text-card-foreground p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
      {children ? <div className="pt-2">{children}</div> : null}
    </section>
  )
}
