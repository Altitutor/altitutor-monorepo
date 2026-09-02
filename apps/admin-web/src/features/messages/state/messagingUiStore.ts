'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ConversationSelection } from '../types';

export type ConversationListFilter = 'all' | 'unread' | 'unreplied' | 'to_follow_up';

type MessagingUiState = {
  dropdownView: 'list' | 'thread';
  dropdownSelection: ConversationSelection | null;
  listFilter: ConversationListFilter;
  ownedNumberFilter: string | null;
  drafts: Record<string, string>;
  setDropdownView: (view: 'list' | 'thread') => void;
  setDropdownSelection: (selection: ConversationSelection | null) => void;
  setListFilter: (filter: ConversationListFilter) => void;
  setOwnedNumberFilter: (ownedNumberId: string | null) => void;
  setDraft: (key: string, text: string) => void;
  clearDraft: (key: string) => void;
};

const sessionStorageImpl = {
  getItem: (name: string) => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(name);
  },
  setItem: (name: string, value: string) => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(name, value);
  },
  removeItem: (name: string) => {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(name);
  },
};

export function getMessagingDraftKey(
  selection: ConversationSelection | { kind: 'contact'; contactId: string | null } | null
): string | null {
  if (!selection) return null;
  if (selection.kind === 'contact') {
    return selection.contactId ? `contact:${selection.contactId}` : null;
  }
  return `group:${selection.conversationId}`;
}

export const useMessagingUiStore = create<MessagingUiState>()(
  persist(
    (set) => ({
      dropdownView: 'list',
      dropdownSelection: null,
      listFilter: 'all',
      ownedNumberFilter: null,
      drafts: {},
      setDropdownView: (dropdownView) => set({ dropdownView }),
      setDropdownSelection: (dropdownSelection) => set({ dropdownSelection }),
      setListFilter: (listFilter) => set({ listFilter }),
      setOwnedNumberFilter: (ownedNumberFilter) => set({ ownedNumberFilter }),
      setDraft: (key, text) =>
        set((state) => {
          if ((state.drafts[key] ?? '') === text) return state;
          return { drafts: { ...state.drafts, [key]: text } };
        }),
      clearDraft: (key) =>
        set((state) => {
          if (!(key in state.drafts)) return state;
          const { [key]: _removed, ...rest } = state.drafts;
          return { drafts: rest };
        }),
    }),
    {
      name: 'admin-messaging-ui',
      storage: createJSONStorage(() => sessionStorageImpl),
      skipHydration: true,
      partialize: (state) => ({
        dropdownView: state.dropdownView,
        dropdownSelection: state.dropdownSelection,
        listFilter: state.listFilter,
        ownedNumberFilter: state.ownedNumberFilter,
        drafts: state.drafts,
      }),
    }
  )
);

export function useMessagingUiHydration() {
  useEffect(() => {
    void useMessagingUiStore.persist.rehydrate();
  }, []);
}

export function usePersistedConversationDraft(draftKey: string | null) {
  const draft = useMessagingUiStore((s) => (draftKey ? (s.drafts[draftKey] ?? '') : ''));
  const setDraft = useMessagingUiStore((s) => s.setDraft);
  const clearDraft = useMessagingUiStore((s) => s.clearDraft);

  return {
    draft,
    onDraftChange: (text: string) => {
      if (draftKey) setDraft(draftKey, text);
    },
    onDraftClear: () => {
      if (draftKey) clearDraft(draftKey);
    },
  };
}
