import type { ReactNode } from 'react'

export function UcatFloatingPanel({
  title,
  titleIcon,
  onClose,
  children,
  className,
}: {
  title: string
  titleIcon?: ReactNode
  onClose?: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-md border-2 border-[#1b4c7d] bg-[#0b6ca2] text-white shadow-2xl ${className ?? ''}`}>
      <header className="flex items-center justify-between border-b border-[#b8d0ea] px-3 py-2 text-xl font-medium">
        <div className="flex items-center gap-2">
          {titleIcon ? <span className="inline-flex">{titleIcon}</span> : null}
          <span>{title}</span>
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} className="inline-flex text-white/90 hover:text-white" aria-label="Close panel">
            ×
          </button>
        ) : null}
      </header>
      <div className="bg-[#5a84bf] p-3">{children}</div>
    </section>
  )
}
