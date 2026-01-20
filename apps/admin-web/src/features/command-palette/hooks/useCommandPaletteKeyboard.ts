/**
 * Hook for keyboard navigation in Command Palette
 */

import { useCallback, type KeyboardEvent } from 'react';
import type { CommandPaletteItem } from './useCommandPaletteFiltering';

interface UseCommandPaletteKeyboardOptions {
  filteredItems: CommandPaletteItem[];
  selectedIndex: number;
  onIndexChange: (index: number) => void;
  onSelectItem: (item: CommandPaletteItem) => void;
  onClose: () => void;
}

export function useCommandPaletteKeyboard({
  filteredItems,
  selectedIndex,
  onIndexChange,
  onSelectItem,
  onClose,
}: UseCommandPaletteKeyboardOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault();
        onIndexChange(
          selectedIndex < filteredItems.length - 1 ? selectedIndex + 1 : 0
        );
        return;
      }

      if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault();
        onIndexChange(
          selectedIndex > 0 ? selectedIndex - 1 : filteredItems.length - 1
        );
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        const selectedItem = filteredItems[selectedIndex];
        if (selectedItem) {
          onSelectItem(selectedItem);
        }
      }
    },
    [filteredItems, selectedIndex, onIndexChange, onSelectItem, onClose]
  );

  return { handleKeyDown };
}
