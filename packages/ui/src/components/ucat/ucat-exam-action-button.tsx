import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { UCAT_FONTS } from './ucat-theme'

type UcatExamActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: 'default' | 'highlight'
  /** 'x' = left/right only (footer), 'all' = full border (dialogs/popups) */
  borders?: 'x' | 'all'
  icon?: ReactNode
  iconRight?: boolean
}

export function UcatExamActionButton({
  children,
  variant = 'default',
  borders = 'x',
  className,
  icon,
  iconRight = false,
  ...rest
}: UcatExamActionButtonProps) {
  const borderClass =
    borders === 'all'
      ? 'border-2 border-white'
      : 'border-x-2 border-y-0 border-white'
  const base = `inline-flex h-9 items-center justify-center gap-1.5 ${borderClass} px-3 font-[${UCAT_FONTS.message}] text-[12pt] leading-none transition-colors`
  const variantClass =
    variant === 'highlight'
      ? 'border-white text-white hover:border-[#fffd6f] hover:text-[#fffd6f]'
      : 'border-white text-white hover:text-[#fffd6f]'

  return (
    <button {...rest} className={`${base} ${variantClass} ${className ?? ''}`}>
      {icon && !iconRight ? <span className="inline-flex items-center">{icon}</span> : null}
      {children}
      {icon && iconRight ? <span className="inline-flex items-center">{icon}</span> : null}
    </button>
  )
}
