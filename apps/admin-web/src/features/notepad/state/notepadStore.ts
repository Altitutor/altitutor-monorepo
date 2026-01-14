'use client';

import { create } from 'zustand';

type NotepadStoreState = {
  isOpen: boolean;
  content: string;
  setContent: (content: string) => void;
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
};

export const useNotepadStore = create<NotepadStoreState>((set) => ({
  isOpen: false,
  content: '',
  setContent: (content: string) => set({ content }),
  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
  setOpen: (open: boolean) => set({ isOpen: open }),
}));
