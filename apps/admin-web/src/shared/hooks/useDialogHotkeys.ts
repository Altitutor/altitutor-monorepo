import { useEffect } from 'react';

interface UseDialogHotkeysParams {
  isOpen: boolean;
  /**
   * Called when the primary action for the dialog should run
   * (e.g. submit, save, create, confirm).
   */
  onPrimaryAction?: () => void;
  /**
   * Optional handler for "next step" flows in multi-step dialogs.
   * When provided and `hasNextStep` is true, this will be invoked
   * instead of `onPrimaryAction`.
   */
  onNextStep?: () => void;
  /**
   * Indicates whether there is a next step available in the dialog.
   */
  hasNextStep?: boolean;
  /**
   * When true, the primary / next-step action is disabled and
   * keyboard shortcuts will be ignored.
   */
  isActionDisabled?: boolean;
}

/**
 * Global keyboard shortcuts for dialogs.
 *
 * - Cmd+Enter / Ctrl+Enter: run next step (when available) or primary action.
 */
export function useDialogHotkeys({
  isOpen,
  onPrimaryAction,
  onNextStep,
  hasNextStep,
  isActionDisabled,
}: UseDialogHotkeysParams): void {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!((event.metaKey || event.ctrlKey) && event.key === 'Enter')) {
        return;
      }

      if (isActionDisabled) {
        return;
      }

      event.preventDefault();

      if (hasNextStep && onNextStep) {
        onNextStep();
        return;
      }

      if (onPrimaryAction) {
        onPrimaryAction();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onPrimaryAction, onNextStep, hasNextStep, isActionDisabled]);
}

