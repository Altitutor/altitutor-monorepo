'use client'

import { Info } from 'lucide-react'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '../lib/cn'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip'

export type SegmentedControlOption<T extends string> = {
  value: T
  label: string
  infoTooltip?: string
  /** Optional count/status badge rendered after the label */
  badge?: number | string | null
}

export type SegmentedControlProps<T extends string> = {
  value: T
  onValueChange: (value: T) => void
  options: SegmentedControlOption<T>[]
  className?: string
  /** Fixed light chrome for white UCAT engine surfaces — ignores app dark mode on the track */
  variant?: 'default' | 'light'
  size?: 'default' | 'sm'
  fullWidth?: boolean
  'aria-label'?: string
}

type IndicatorRect = {
  left: number
  top: number
  width: number
  height: number
}

const INDICATOR_STYLE = {
  transition:
    'left 0.28s cubic-bezier(0.32, 0.72, 0, 1), top 0.28s cubic-bezier(0.32, 0.72, 0, 1), width 0.28s cubic-bezier(0.32, 0.72, 0, 1), height 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
} as const

const segmentTabPadding = 'inline-flex items-center justify-center gap-1.5 px-3 py-1.5'

function SegmentBadge({
  badge,
  isActive,
  isLight,
}: {
  badge: number | string
  isActive: boolean
  isLight: boolean
}) {
  const numeric = typeof badge === 'number' ? badge : Number(badge)
  const isZero = Number.isFinite(numeric) && numeric === 0

  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold leading-none tabular-nums',
        isZero
          ? isLight
            ? 'bg-black/10 text-black/55'
            : 'bg-muted-foreground/15 text-muted-foreground'
          : isActive
            ? 'bg-destructive text-destructive-foreground'
            : isLight
              ? 'bg-red-600/90 text-white'
              : 'bg-destructive/90 text-destructive-foreground',
      )}
    >
      {badge}
    </span>
  )
}

function SegmentLabel({
  label,
  badge,
  isActive,
  isLight,
}: {
  label: string
  badge?: number | string | null
  isActive: boolean
  isLight: boolean
}) {
  return (
    <>
      <span className="truncate">{label}</span>
      {badge != null && badge !== '' ? (
        <SegmentBadge badge={badge} isActive={isActive} isLight={isLight} />
      ) : null}
    </>
  )
}

/**
 * Track uses `p-0.5` (0.125rem). Inner radius = outer − inset.
 * Values must be static strings so Tailwind JIT emits them.
 */
const SEGMENTED_RADII = {
  default: {
    track: 'rounded-[var(--radius)]',
    inner: 'rounded-[calc(var(--radius)_-_0.125rem)]',
  },
  light: {
    track: 'rounded-[var(--radius)]',
    inner: 'rounded-[calc(var(--radius)_-_0.125rem)]',
  },
} as const

export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  className,
  variant = 'default',
  size = 'default',
  fullWidth = false,
  'aria-label': ariaLabel,
}: SegmentedControlProps<T>) {
  const isLight = variant === 'light'
  const containerRef = useRef<HTMLDivElement>(null)
  const segmentRefs = useRef(new Map<string, HTMLElement>())
  const [indicator, setIndicator] = useState<IndicatorRect | null>(null)
  const [reduceMotion, setReduceMotion] = useState(false)

  useLayoutEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduceMotion(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const setSegmentRef = useCallback(
    (optionValue: string) => (el: HTMLElement | null) => {
      if (el) {
        segmentRefs.current.set(optionValue, el)
      } else {
        segmentRefs.current.delete(optionValue)
      }
    },
    []
  )

  const updateIndicator = useCallback(() => {
    const container = containerRef.current
    const activeEl = segmentRefs.current.get(value)
    if (!container || !activeEl) {
      setIndicator((prev) => (prev === null ? prev : null))
      return
    }

    const containerRect = container.getBoundingClientRect()
    const activeRect = activeEl.getBoundingClientRect()
    const next = {
      left: activeRect.left - containerRect.left,
      top: activeRect.top - containerRect.top,
      width: activeRect.width,
      height: activeRect.height,
    }
    setIndicator((prev) => {
      if (
        prev &&
        prev.left === next.left &&
        prev.top === next.top &&
        prev.width === next.width &&
        prev.height === next.height
      ) {
        return prev
      }
      return next
    })
  }, [value])

  const optionsKey = options
    .map((option) => `${option.value}:${option.badge ?? ''}`)
    .join('\0')

  useLayoutEffect(() => {
    updateIndicator()

    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver(() => updateIndicator())
    resizeObserver.observe(container)
    for (const el of segmentRefs.current.values()) {
      resizeObserver.observe(el)
    }

    window.addEventListener('resize', updateIndicator)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateIndicator)
    }
  }, [updateIndicator, optionsKey])

  const textSizeClass = size === 'sm' ? 'text-[10pt]' : 'text-xs'
  const radii = SEGMENTED_RADII[isLight ? 'light' : 'default']

  return (
    <TooltipProvider delayDuration={200}>
      <div
        ref={containerRef}
        className={cn(
          'relative inline-flex min-w-0 border-0 p-0.5',
          textSizeClass,
          fullWidth && 'w-full min-w-0',
          'max-w-full overflow-x-auto overscroll-x-contain',
          isLight
            ? cn(radii.track, 'bg-neutral-200/80 ring-1 ring-black/10')
            : cn(radii.track, 'bg-muted/90 ring-1 ring-black/[0.06] dark:ring-white/10'),
          className
        )}
        role="tablist"
        aria-label={ariaLabel}
      >
        {indicator ? (
          <div
            aria-hidden
            className={cn(
              'pointer-events-none absolute z-0 shadow-sm',
              radii.inner,
              isLight
                ? 'bg-white ring-1 ring-black/10'
                : 'bg-card ring-1 ring-black/[0.05] dark:ring-white/[0.07]'
            )}
            style={{
              left: indicator.left,
              top: indicator.top,
              width: indicator.width,
              height: indicator.height,
              ...(reduceMotion ? {} : INDICATOR_STYLE),
            }}
          />
        ) : null}

        {options.map((option) => {
          const isActive = value === option.value

          if (option.infoTooltip) {
            return (
              <div
                key={option.value}
                ref={setSegmentRef(option.value)}
                className={cn(
                  'group relative z-10 inline-flex items-stretch overflow-hidden',
                  radii.inner,
                  fullWidth && 'min-w-0 flex-1 max-sm:min-w-max max-sm:flex-none',
                  isLight
                    ? isActive
                      ? 'text-black'
                      : 'text-black/60'
                    : isActive
                      ? 'text-foreground'
                      : 'text-foreground'
                )}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onValueChange(option.value)}
                  className={cn(
                    segmentTabPadding,
                    'rounded-l-md rounded-r-none',
                    fullWidth && 'min-w-0 flex-1 max-sm:min-w-max max-sm:flex-none',
                    !isActive && (isLight ? 'hover:bg-black/5' : 'hover:bg-muted/80')
                  )}
                >
                  <SegmentLabel
                    label={option.label}
                    badge={option.badge}
                    isActive={isActive}
                    isLight={isLight}
                  />
                </button>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        'inline-flex items-center justify-center rounded-r-md rounded-l-none border-l px-2 py-1.5',
                        'text-muted-foreground transition-colors duration-200',
                        'hover:text-foreground',
                        !isActive && 'group-hover:bg-muted/80',
                        isActive
                          ? 'border-foreground/12'
                          : 'border-black/[0.06] dark:border-white/12'
                      )}
                      aria-label="About this option"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Info className="h-3 w-3 shrink-0" aria-hidden />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[240px]">
                    {option.infoTooltip}
                  </TooltipContent>
                </Tooltip>
              </div>
            )
          }

          return (
            <button
              key={option.value}
              ref={setSegmentRef(option.value)}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onValueChange(option.value)}
              className={cn(
                segmentTabPadding,
                'relative z-10 transition-colors duration-200',
                radii.inner,
                fullWidth && 'min-w-0 flex-1 max-sm:min-w-max max-sm:flex-none',
                isLight
                  ? isActive
                    ? 'text-black'
                    : 'text-black/60 hover:bg-black/5'
                  : isActive
                    ? 'text-foreground'
                    : 'text-foreground hover:bg-muted/80'
              )}
            >
              <SegmentLabel
                label={option.label}
                badge={option.badge}
                isActive={isActive}
                isLight={isLight}
              />
            </button>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
