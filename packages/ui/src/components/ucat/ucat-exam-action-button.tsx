import type { ButtonHTMLAttributes, ReactNode } from 'react'

type UcatExamActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: 'default' | 'highlight'
  icon?: ReactNode
  iconRight?: boolean
}

export function UcatExamActionButton({
  children,
  variant = 'default',
  className,
  icon,
  iconRight = false,
  ...rest
}: UcatExamActionButtonProps) {
  const base =
    'inline-flex h-9 items-center justify-center gap-1.5 border px-3 text-base font-medium leading-none transition-colors sm:text-[30px]'
  const variantClass =
    variant === 'highlight'
      ? 'border-[#f4e631] text-[#f4e631] hover:bg-[#f4e631] hover:text-[#005f9e]'
      : 'border-white text-white hover:bg-white hover:text-[#005f9e]'

  return (
    <button {...rest} className={`${base} ${variantClass} ${className ?? ''}`}>
      {icon && !iconRight ? <span className="inline-flex items-center">{icon}</span> : null}
      <span className="underline">{children}</span>
      {icon && iconRight ? <span className="inline-flex items-center">{icon}</span> : null}
    </button>
  )
}
