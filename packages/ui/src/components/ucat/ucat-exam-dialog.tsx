import type { ReactNode } from 'react'

export function UcatExamDialog({
  title,
  icon,
  message,
  actions,
  className,
}: {
  title: string
  icon?: ReactNode
  message: ReactNode
  actions: ReactNode
  className?: string
}) {
  return (
    <section className={`w-full rounded-md border-2 border-[#1b4c7d] bg-[#0b6ca2] text-white shadow-2xl ${className ?? ''}`}>
      <header className="border-b border-[#b8d0ea] px-3 py-2 text-2xl font-medium sm:text-[34px]">{title}</header>
      <div className="flex items-start gap-4 px-4 py-6 sm:px-6">
        {icon ? <div className="pt-1 text-[52px] text-[#7fd3ff]">{icon}</div> : null}
        <div className="flex-1 space-y-6 text-xl sm:text-[34px]">
          <div>{message}</div>
          <div className="flex items-center justify-center gap-3">{actions}</div>
        </div>
      </div>
    </section>
  )
}
