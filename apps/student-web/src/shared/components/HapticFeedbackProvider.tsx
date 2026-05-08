'use client'

import { useEffect } from 'react'
import { WebHaptics } from 'web-haptics'

const INTERACTIVE_SELECTOR =
  'button, a[href], [role="button"], [role="menuitem"], [role="tab"], [data-haptic]'

const HAPTIC_TYPES = new Set(['selection', 'success', 'warning', 'error'])

function resolveHapticType(target: Element): 'selection' | 'success' | 'warning' | 'error' {
  const hapticType = target.getAttribute('data-haptic')

  if (hapticType && HAPTIC_TYPES.has(hapticType)) {
    return hapticType as 'selection' | 'success' | 'warning' | 'error'
  }

  return 'selection'
}

export function HapticFeedbackProvider(): null {
  useEffect(() => {
    if (!WebHaptics.isSupported || !window.matchMedia('(pointer: coarse)').matches) {
      return
    }

    const haptics = new WebHaptics({ showSwitch: false })

    const handlePointerDown = (event: PointerEvent): void => {
      if (event.pointerType && event.pointerType !== 'touch') {
        return
      }

      if (!(event.target instanceof Element)) {
        return
      }

      const interactiveTarget = event.target.closest(INTERACTIVE_SELECTOR)
      if (!interactiveTarget) {
        return
      }

      const isDisabled =
        interactiveTarget.matches('[disabled]') ||
        interactiveTarget.getAttribute('aria-disabled') === 'true'

      if (isDisabled) {
        return
      }

      void haptics.trigger(resolveHapticType(interactiveTarget))
    }

    document.addEventListener('pointerdown', handlePointerDown, true)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      haptics.destroy()
    }
  }, [])

  return null
}
