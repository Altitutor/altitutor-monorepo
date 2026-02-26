import type { ReactNode } from 'react'
import { UCAT_COLORS, UCAT_FONTS } from './ucat-theme'

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
    <section
      className={`w-full rounded-md border-2 text-white shadow-2xl ${className ?? ''}`}
      style={{ borderColor: UCAT_COLORS.primaryBlueDark, backgroundColor: UCAT_COLORS.primaryBlue }}
    >
      <header
        className={`border-b px-3 py-1.5 font-[${UCAT_FONTS.message}] text-[12pt] font-normal`}
        style={{ borderColor: '#b8d0ea' }}
      >
        {title}
      </header>
      <div className="flex items-start gap-4 px-4 py-4 sm:px-6">
        {icon ? <div className="pt-1 text-[32px] text-[#7fd3ff]">{icon}</div> : null}
        <div className={`flex-1 space-y-4 font-[${UCAT_FONTS.message}] text-[12pt]`}>
          <div>{message}</div>
          <div className="flex items-center justify-center gap-3">{actions}</div>
        </div>
      </div>
    </section>
  )
}
