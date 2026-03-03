import type { ReactNode } from 'react'
import { UCAT_COLORS, UCAT_FONTS } from './ucat-theme'

export function UcatExamShell({
  sectionTitle,
  sectionTitleRight,
  toolLeft,
  toolRight,
  footerLeft,
  footerRight,
  overlay,
  children,
}: {
  sectionTitle: string
  sectionTitleRight?: ReactNode
  toolLeft?: ReactNode
  toolRight?: ReactNode
  footerLeft?: ReactNode
  footerRight?: ReactNode
  overlay?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="relative h-full min-h-0 overflow-hidden bg-white text-black" data-ucat-shell-root="true">
      <div className="flex h-full min-h-0 flex-col bg-white">
        <header
          className={`flex items-center justify-between border-b-2 px-3 pt-3 pb-1.5 font-[${UCAT_FONTS.message}] text-[16pt] font-normal text-white`}
          style={{ borderColor: UCAT_COLORS.primaryBlue, backgroundColor: UCAT_COLORS.primaryBlue }}
        >
          <span>{sectionTitle}</span>
          {sectionTitleRight ? (
            <span className="text-[12pt] font-normal">{sectionTitleRight}</span>
          ) : null}
        </header>

        <div
          className={`flex min-h-[30px] items-center justify-between border-b px-3 font-[${UCAT_FONTS.message}] text-[12pt] text-white`}
          style={{ borderColor: UCAT_COLORS.toolbarBorderBlue, backgroundColor: UCAT_COLORS.toolbarBlue }}
        >
          <div className="flex items-center gap-3">{toolLeft}</div>
          <div className="flex items-center gap-3">{toolRight}</div>
        </div>

        <div className="flex-1 min-h-0 bg-white px-4 py-0 sm:px-5" data-ucat-scroll="content">
          <div className="h-full min-h-0 overflow-hidden">{children}</div>
        </div>
        <footer
          className="flex shrink-0 items-center justify-between gap-4 px-4 py-2"
          style={{ backgroundColor: UCAT_COLORS.primaryBlue }}
        >
          <div className="flex items-stretch gap-2">{footerLeft}</div>
          <div className="flex items-stretch gap-2">{footerRight}</div>
        </footer>
      </div>

      {overlay ? <div className="absolute inset-0 z-40">{overlay}</div> : null}
    </section>
  )
}

