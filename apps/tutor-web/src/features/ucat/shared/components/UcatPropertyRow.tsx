import React, { type ReactNode } from 'react'

type UcatPropertyRowProps = {
  label: ReactNode
  children: ReactNode
}

export function UcatPropertyRow({ label, children }: UcatPropertyRowProps) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-start gap-3 py-1.5">
      <span className="pt-2.5 text-sm text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
