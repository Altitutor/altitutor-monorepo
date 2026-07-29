import * as React from "react"
import { tryActivateDialogPrimaryAction } from "../lib/dialog-primary-shortcut"

/**
 * Registers a capture-phase Cmd/Ctrl+Enter listener that activates the dialog's
 * primary footer action while this content node is the topmost open modal.
 */
export function useDialogPrimaryActionShortcut(
  contentRef: React.RefObject<HTMLElement | null>,
  enabled = true,
): void {
  React.useEffect(() => {
    if (!enabled) return

    const onKeyDown = (event: KeyboardEvent) => {
      const root = contentRef.current
      if (!root) return
      tryActivateDialogPrimaryAction(root, event)
    }

    document.addEventListener("keydown", onKeyDown, true)
    return () => document.removeEventListener("keydown", onKeyDown, true)
  }, [contentRef, enabled])
}
