'use client';

import { create } from 'zustand';

type NotepadStoreState = {
  isOpen: boolean;
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
};

export const useNotepadStore = create<NotepadStoreState>((set) => ({
  isOpen: false,
  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
  setOpen: (open: boolean) => set({ isOpen: open }),
}));
