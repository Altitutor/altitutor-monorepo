'use client';

import { create } from 'zustand';

export type ChatWindowDescriptor = {
  conversationId: string;
  title?: string;
  minimized: boolean;
  unreadCount: number;
};

type ChatStoreState = {
  windows: ChatWindowDescriptor[];
  openWindow: (win: { conversationId: string; title?: string }) => void;
  closeWindow: (conversationId: string) => void;
  minimizeWindow: (conversationId: string, minimized: boolean) => void;
  focusWindow: (conversationId: string) => void;
  incrementUnread: (conversationId: string) => void;
  resetUnread: (conversationId: string) => void;
  updateWindowTitle: (conversationId: string, title: string) => void;
  hasWindow: (conversationId: string) => boolean;
};

export const useChatStore = create<ChatStoreState>((set, get) => ({
  windows: [],
  openWindow: ({ conversationId, title }) => {
    const existing = get().windows.find(w => w.conversationId === conversationId);
    if (existing) {
      set({
        windows: get().windows.map(w =>
          w.conversationId === conversationId ? { ...w, minimized: false } : w
        ),
      });
      return;
    }
    set({
      windows: [
        ...get().windows,
        { conversationId, title, minimized: false, unreadCount: 0 },
      ].slice(-4), // cap to 4 open windows
    });
  },
  closeWindow: (conversationId) => {
    set({ windows: get().windows.filter(w => w.conversationId !== conversationId) });
  },
  minimizeWindow: (conversationId, minimized) => {
    set({
      windows: get().windows.map(w =>
        w.conversationId === conversationId ? { ...w, minimized } : w
      ),
    });
  },
  focusWindow: (conversationId) => {
    set({
      windows: get().windows.map(w =>
        w.conversationId === conversationId ? { ...w, minimized: false, unreadCount: 0 } : w
      ),
    });
  },
  incrementUnread: (conversationId) => {
    set({
      windows: get().windows.map(w =>
        w.conversationId === conversationId ? { ...w, unreadCount: w.unreadCount + 1 } : w
      ),
    });
  },
  resetUnread: (conversationId) => {
    set({
      windows: get().windows.map(w =>
        w.conversationId === conversationId ? { ...w, unreadCount: 0 } : w
      ),
    });
  },
  updateWindowTitle: (conversationId, title) => {
    set({
      windows: get().windows.map(w =>
        w.conversationId === conversationId ? { ...w, title } : w
      ),
    });
  },
  hasWindow: (conversationId) => {
    return !!get().windows.find(w => w.conversationId === conversationId);
  },
}));


