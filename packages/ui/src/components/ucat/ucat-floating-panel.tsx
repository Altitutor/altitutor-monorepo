import type { ReactNode } from 'react'
import { UCAT_COLORS, UCAT_FONTS } from './ucat-theme'

export function UcatFloatingPanel({
  title,
  titleIcon,
  onClose,
  onDragMouseDown,
  children,
  className,
  contentClassName,
}: {
  title: string
  titleIcon?: ReactNode
  onClose?: () => void
  onDragMouseDown?: (event: React.MouseEvent<HTMLDivElement>) => void
  children: ReactNode
  className?: string
  /** Applied to the content wrapper so it can participate in flex layout (e.g. flex-1 min-h-0). */
  contentClassName?: string
}) {
  return (
    <section
      className={`rounded-md border-2 text-white shadow-2xl ${className ?? ''}`}
      style={{ borderColor: UCAT_COLORS.primaryBlueDark, backgroundColor: UCAT_COLORS.primaryBlue }}
    >
      <header
        className="flex cursor-move items-center justify-between border-b border-[#b8d0ea] px-3 py-2 text-xl font-medium"
        onMouseDown={onDragMouseDown}
      >
        <div className={`flex items-center gap-2 font-[${UCAT_FONTS.message}]`}>
          {titleIcon ? <span className="inline-flex">{titleIcon}</span> : null}
          <span>{title}</span>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-sm border border-white px-1 py-0 text-white/90 hover:border-[#fffd6f] hover:text-[#fffd6f]"
            aria-label="Close panel"
          >
            ×
          </button>
        ) : null}
      </header>
      <div className={`bg-[#5a84bf] p-3 ${contentClassName ?? ''}`}>{children}</div>
    </section>
  )
}
