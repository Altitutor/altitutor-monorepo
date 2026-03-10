import { useMemo } from 'react';
import { ReactRenderer } from '@tiptap/react';
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import { entityTypes } from '@/features/command-palette/config/commandPalette.config';
import { MentionList, type MentionListRef } from '@/shared/components/MentionList';
import type { CommandPaletteEntityResult } from '@/features/command-palette/types';

type MentionSearchType = keyof typeof entityTypes;

interface UseMentionSuggestionsOptions {
  types?: readonly MentionSearchType[];
}

/**
 * Hook to provide suggestion configuration for Tiptap Mention extension.
 * Items resolve immediately so the dropdown (pills) appears right away;
 * MentionList fetches results via useEntitySearch and shows skeleton while loading.
 */
const DEFAULT_MENTION_TYPES = [
  'students',
  'staff',
  'parents',
  'classes',
  'subjects',
  'tasks',
  'issues',
  'projects',
  'topics',
  'files',
  'notes',
] as const;

export function useMentionSuggestions(options?: UseMentionSuggestionsOptions) {
  const types = useMemo(
    () => options?.types ?? DEFAULT_MENTION_TYPES,
    [options?.types]
  );

  return useMemo(() => ({
    items: async (_props: { query: string }): Promise<CommandPaletteEntityResult[]> => {
      // Resolve immediately so TipTap shows the dropdown right away.
      // MentionList uses useEntitySearch internally for actual results.
      return [];
    },

    render: () => {
      let component: ReactRenderer<MentionListRef> | undefined;
      let popup: TippyInstance[] | undefined;

      return {
        onStart: (props: SuggestionProps) => {
          component = new ReactRenderer(MentionList, {
            props: { ...props, types },
            editor: props.editor,
          });

          if (!props.clientRect) {
            return;
          }

          const getRect = () => props.clientRect?.() ?? new DOMRect(0, 0, 0, 0);
          popup = tippy('body', {
            getReferenceClientRect: getRect,
            appendTo: () => {
              const dialog = props.editor.view.dom.closest('[role="dialog"]');
              if (dialog) {
                return dialog;
              }
              return document.body;
            },
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
          });
        },

        onUpdate(props: SuggestionProps) {
          if (!component) return;
          component.updateProps(props);

          if (!props.clientRect || !popup?.[0]) {
            return;
          }

          const getRect = () => props.clientRect?.() ?? new DOMRect(0, 0, 0, 0);
          popup[0].setProps({
            getReferenceClientRect: getRect,
          });
        },

        onKeyDown(props: SuggestionKeyDownProps) {
          if (props.event.key === 'Escape') {
            if (popup?.[0]) {
              try {
                popup[0].hide();
              } catch {
                // Ignore if already destroyed
              }
            }
            return true;
          }

          return component?.ref?.onKeyDown(props) ?? false;
        },

        onExit() {
          if (popup?.[0]) {
            try {
              popup[0].destroy();
            } catch {
              // Ignore if already destroyed
            }
          }
          component?.destroy();
        },
      };
    },
  }), [types]);
}
