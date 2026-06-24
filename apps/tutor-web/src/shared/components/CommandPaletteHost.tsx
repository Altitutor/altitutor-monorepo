'use client';

import { CommandPaletteModal } from '@/features/command-palette';
import { useCommandPalette } from '@/shared/contexts/CommandPaletteContext';

export function CommandPaletteHost() {
  const { isOpen, close } = useCommandPalette();
  return <CommandPaletteModal isOpen={isOpen} onClose={close} />;
}
