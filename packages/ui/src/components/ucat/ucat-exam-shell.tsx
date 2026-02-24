import type { ReactNode } from 'react'

export function UcatExamShell({
  sectionTitle,
  toolLeft,
  toolRight,
  footerLeft,
  footerRight,
  overlay,
  children,
}: {
  sectionTitle: string
  toolLeft?: ReactNode
  toolRight?: ReactNode
  footerLeft?: ReactNode
  footerRight?: ReactNode
  overlay?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="relative min-h-[calc(100vh-120px)] overflow-hidden rounded-xl border-4 border-black bg-black text-black">
      <div className="h-full bg-[#dcdcdc] pb-12">
        <header className="border-b-2 border-[#0b6ca2] bg-[#0b6ca2] px-3 py-2 text-2xl font-medium text-white sm:text-[34px]">
          {sectionTitle}
        </header>

        <div className="flex min-h-8 items-center justify-between border-b border-[#3f6fb2] bg-[#4f7ec1] px-3 text-sm text-white sm:text-base">
          <div className="flex items-center gap-3">{toolLeft}</div>
          <div className="flex items-center gap-3">{toolRight}</div>
        </div>

        <div className="min-h-[calc(100vh-232px)] bg-[#dcdcdc] p-4 sm:p-5">{children}</div>
      </div>

      <footer className="absolute inset-x-0 bottom-0 flex h-12 items-center justify-between bg-[#0b6ca2] px-2">
        <div className="flex items-center gap-1">{footerLeft}</div>
        <div className="flex items-center gap-1">{footerRight}</div>
      </footer>

      {overlay ? <div className="absolute inset-0 z-40">{overlay}</div> : null}
    </section>
  )
}
