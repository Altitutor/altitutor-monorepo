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

/**
 * Track uses `p-0.5` (0.125rem). Inner radius = outer − inset.
 * Values must be static strings so Tailwind JIT emits them.
 */
const SEGMENTED_RADII = {
  default: {
    track: 'overflow-hidden rounded-2xl',
    inner: 'rounded-[0.875rem]',
  },
  light: {
    track: 'overflow-hidden rounded-md',
    inner: 'rounded',
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
      setIndicator(null)
      return
    }

    const containerRect = container.getBoundingClientRect()
    const activeRect = activeEl.getBoundingClientRect()
    setIndicator({
      left: activeRect.left - containerRect.left,
      top: activeRect.top - containerRect.top,
      width: activeRect.width,
      height: activeRect.height,
    })
  }, [value])

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
  }, [updateIndicator, options])

  const textSizeClass = size === 'sm' ? 'text-[10pt]' : 'text-xs'
  const radii = SEGMENTED_RADII[isLight ? 'light' : 'default']

  return (
    <TooltipProvider delayDuration={200}>
      <div
        ref={containerRef}
        className={cn(
          'relative inline-flex border-0 p-0.5',
          textSizeClass,
          fullWidth && 'w-full',
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
                  fullWidth && 'min-w-0 flex-1',
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
                    fullWidth && 'min-w-0 flex-1',
                    !isActive && (isLight ? 'hover:bg-black/5' : 'hover:bg-muted/80')
                  )}
                >
                  {option.label}
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
                fullWidth && 'min-w-0 flex-1',
                isLight
                  ? isActive
                    ? 'text-black'
                    : 'text-black/60 hover:bg-black/5'
                  : isActive
                    ? 'text-foreground'
                    : 'text-foreground hover:bg-muted/80'
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
