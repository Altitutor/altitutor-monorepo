'use client';

import { create } from 'zustand';

export type ChatWindowDescriptor = {
  conversationId: string;
  title?: string;
  minimized: boolean;
  unreadCount: number;
};

type ChatStoreState = {
  // Single active conversation (unified window)
  activeConversationId: string | null;
  minimized: boolean;
  // Track all conversations with unread counts
  conversations: Map<string, { unreadCount: number; title?: string }>;
  setActiveConversation: (conversationId: string | null) => void;
  toggleMinimize: () => void;
  incrementUnread: (conversationId: string) => void;
  resetUnread: (conversationId: string) => void;
  updateConversationTitle: (conversationId: string, title: string) => void;
  hasConversation: (conversationId: string) => boolean;
  // Legacy methods for backward compatibility (will be removed)
  windows: ChatWindowDescriptor[];
  openWindow: (win: { conversationId: string; title?: string }) => void;
  closeWindow: (conversationId: string) => void;
  minimizeWindow: (conversationId: string, minimized: boolean) => void;
  focusWindow: (conversationId: string) => void;
  updateWindowTitle: (conversationId: string, title: string) => void;
  hasWindow: (conversationId: string) => boolean;
};

export const useChatStore = create<ChatStoreState>((set, get) => ({
  // New unified state
  activeConversationId: null,
  minimized: false,
  conversations: new Map(),
  
  setActiveConversation: (conversationId) => {
    set({ 
      activeConversationId: conversationId,
      minimized: false, // Auto-expand when selecting conversation
    });
    // Reset unread count when selecting
    if (conversationId) {
      const conversations = new Map(get().conversations);
      const existing = conversations.get(conversationId);
      if (existing) {
        conversations.set(conversationId, { ...existing, unreadCount: 0 });
        set({ conversations });
      }
    }
  },
  
  toggleMinimize: () => {
    set({ minimized: !get().minimized });
  },
  
  incrementUnread: (conversationId) => {
    const conversations = new Map(get().conversations);
    const existing = conversations.get(conversationId) || { unreadCount: 0 };
    conversations.set(conversationId, { ...existing, unreadCount: existing.unreadCount + 1 });
    set({ conversations });
  },
  
  resetUnread: (conversationId) => {
    const conversations = new Map(get().conversations);
    const existing = conversations.get(conversationId);
    if (existing) {
      conversations.set(conversationId, { ...existing, unreadCount: 0 });
      set({ conversations });
    }
  },
  
  updateConversationTitle: (conversationId, title) => {
    const conversations = new Map(get().conversations);
    const existing = conversations.get(conversationId) || { unreadCount: 0 };
    conversations.set(conversationId, { ...existing, title });
    set({ conversations });
  },
  
  hasConversation: (conversationId) => {
    return get().conversations.has(conversationId);
  },
  
  // Legacy methods (kept for backward compatibility during transition)
  windows: [],
  openWindow: ({ conversationId, title }) => {
    // Add to conversations map
    const conversations = new Map(get().conversations);
    const existing = conversations.get(conversationId) || { unreadCount: 0 };
    conversations.set(conversationId, { ...existing, title });
    set({ 
      conversations,
      activeConversationId: conversationId,
      minimized: false,
    });
  },
  closeWindow: () => {
    // No-op: chat dock cannot be closed, only minimized
  },
  minimizeWindow: (conversationId, minimized) => {
    if (get().activeConversationId === conversationId) {
      set({ minimized });
    }
  },
  focusWindow: (conversationId) => {
    set({ 
      activeConversationId: conversationId,
      minimized: false,
    });
    get().resetUnread(conversationId);
  },
  updateWindowTitle: (conversationId, title) => {
    get().updateConversationTitle(conversationId, title);
  },
  hasWindow: (conversationId) => {
    return get().hasConversation(conversationId);
  },
}));


