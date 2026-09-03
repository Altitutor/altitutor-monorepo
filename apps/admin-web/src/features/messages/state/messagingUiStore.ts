'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ConversationSelection } from '../types';

export type ConversationListFilter = 'all' | 'unread' | 'unreplied' | 'to_follow_up';
export type MessagingFilterScope = 'dropdown' | 'page';

type MessagingListFilters = {
  listFilter: ConversationListFilter;
  ownedNumberFilter: string | null;
};

const EMPTY_LIST_FILTERS: MessagingListFilters = {
  listFilter: 'all',
  ownedNumberFilter: null,
};

type MessagingUiState = {
  dropdownView: 'list' | 'thread';
  dropdownSelection: ConversationSelection | null;
  filters: Record<MessagingFilterScope, MessagingListFilters>;
  drafts: Record<string, string>;
  setDropdownView: (view: 'list' | 'thread') => void;
  setDropdownSelection: (selection: ConversationSelection | null) => void;
  setListFilter: (scope: MessagingFilterScope, filter: ConversationListFilter) => void;
  setOwnedNumberFilter: (scope: MessagingFilterScope, ownedNumberId: string | null) => void;
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
      filters: {
        dropdown: { ...EMPTY_LIST_FILTERS },
        page: { ...EMPTY_LIST_FILTERS },
      },
      drafts: {},
      setDropdownView: (dropdownView) => set({ dropdownView }),
      setDropdownSelection: (dropdownSelection) => set({ dropdownSelection }),
      setListFilter: (scope, listFilter) =>
        set((state) => ({
          filters: {
            ...state.filters,
            [scope]: { ...(state.filters[scope] ?? EMPTY_LIST_FILTERS), listFilter },
          },
        })),
      setOwnedNumberFilter: (scope, ownedNumberFilter) =>
        set((state) => ({
          filters: {
            ...state.filters,
            [scope]: { ...(state.filters[scope] ?? EMPTY_LIST_FILTERS), ownedNumberFilter },
          },
        })),
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
        filters: state.filters,
        drafts: state.drafts,
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<MessagingUiState>;
        return {
          ...currentState,
          ...persisted,
          filters: {
            dropdown: { ...EMPTY_LIST_FILTERS, ...persisted.filters?.dropdown },
            page: { ...EMPTY_LIST_FILTERS, ...persisted.filters?.page },
          },
        };
      },
    }
  )
);

export function useMessagingUiHydration() {
  useEffect(() => {
    void useMessagingUiStore.persist.rehydrate();
  }, []);
}

export function useMessagingListFilters(scope: MessagingFilterScope) {
  const listFilter = useMessagingUiStore((s) => s.filters[scope]?.listFilter ?? 'all');
  const ownedNumberFilter = useMessagingUiStore((s) => s.filters[scope]?.ownedNumberFilter ?? null);
  const setListFilter = useMessagingUiStore((s) => s.setListFilter);
  const setOwnedNumberFilter = useMessagingUiStore((s) => s.setOwnedNumberFilter);

  return {
    listFilter,
    ownedNumberFilter,
    setListFilter: (filter: ConversationListFilter) => setListFilter(scope, filter),
    setOwnedNumberFilter: (ownedNumberId: string | null) => setOwnedNumberFilter(scope, ownedNumberId),
  };
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
