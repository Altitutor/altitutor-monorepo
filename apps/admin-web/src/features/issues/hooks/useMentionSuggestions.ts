import { useMemo, useRef } from 'react';
import { ReactRenderer } from '@tiptap/react';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import { useQueryClient } from '@tanstack/react-query';
import { studentsApi } from '@/features/students/api/students';
import { staffApi } from '@/features/staff/api/staff';
import { parentsApi } from '@/features/parents/api/parents';
import { classesApi } from '@/features/classes/api/classes';
import { subjectsApi } from '@/features/subjects/api/subjects';
import { topicsApi } from '@/features/topics/api/topics';
import { topicsFilesApi } from '@/features/topics/api/topics-files';
import { entityTypes } from '@/features/command-palette/config/commandPalette.config';
import { MentionList, type MentionListRef } from '../components/MentionList';
import type { CommandPaletteEntityResult } from '@/features/command-palette/types';

/**
 * Hook to provide suggestion configuration for Tiptap Mention extension.
 * Reuses the entity search logic from command palette.
 */
export function useMentionSuggestions() {
  const queryClient = useQueryClient();
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  return useMemo(() => ({
    items: async ({ query }: { query: string }): Promise<CommandPaletteEntityResult[]> => {
      if (!query || query.length < 2) return [];

      // Debounce the search manually since this is a callback
      return new Promise((resolve) => {
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

        searchTimeoutRef.current = setTimeout(async () => {
          const trimmedSearch = query.trim();

          // Perform parallel searches (similar to useEntitySearch but in a functional way for Tiptap)
          const searchPromises = [
            // Students
            studentsApi.searchStudents(trimmedSearch, ['ACTIVE', 'TRIAL'], true)
              .then(res => res.slice(0, 5).map(s => ({ type: 'student' as const, id: s.id, data: s }))),
            
            // Staff
            staffApi.listMinimal({ search: trimmedSearch, statuses: ['ACTIVE'], limit: 5, offset: 0, excludeClassSearch: true })
              .then(res => res.staff.map(s => ({ 
                type: 'staff' as const, 
                id: s.id, 
                data: { id: s.id, first_name: s.first_name, last_name: s.last_name, role: s.role, status: s.status, email: s.email, phone_number: s.phone_number } 
              }))),

            // Parents
            parentsApi.list({ search: trimmedSearch, limit: 5, offset: 0 })
              .then(res => res.parents.map(p => ({ 
                type: 'parent' as const, 
                id: p.id, 
                data: { id: p.id, first_name: p.first_name, last_name: p.last_name, email: p.email, phone: p.phone } 
              }))),

            // Classes
            classesApi.listMinimal({ search: trimmedSearch, limit: 5, offset: 0, excludeStudentSearch: true, excludeStaffSearch: true })
              .then(res => res.classes.map(c => ({ type: 'class' as const, id: c.id, data: c }))),

            // Subjects
            subjectsApi.list({ search: trimmedSearch, limit: 5, offset: 0 })
              .then(res => res.subjects.map(s => ({ type: 'subject' as const, id: s.id, data: s }))),
          ];

          const results = await Promise.allSettled(searchPromises);
          const allResults = results
            .filter((r): r is PromiseFulfilledResult<CommandPaletteEntityResult[]> => r.status === 'fulfilled')
            .flatMap(r => r.value);

          resolve(allResults);
        }, 200);
      });
    },

    render: () => {
      let component: ReactRenderer<MentionListRef>;
      let popup: TippyInstance[];

      return {
        onStart: (props: any) => {
          component = new ReactRenderer(MentionList, {
            props,
            editor: props.editor,
          });

          if (!props.clientRect) {
            return;
          }

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect,
            appendTo: () => {
              // Try to find the nearest dialog to append to, so pointer events aren't blocked by Radix
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

        onUpdate(props: any) {
          component.updateProps(props);

          if (!props.clientRect) {
            return;
          }

          popup[0].setProps({
            getReferenceClientRect: props.clientRect,
          });
        },

        onKeyDown(props: any) {
          if (props.event.key === 'Escape') {
            popup[0].hide();
            return true;
          }

          return component.ref?.onKeyDown(props) ?? false;
        },

        onExit() {
          popup[0].destroy();
          component.destroy();
        },
      };
    },
  }), [queryClient]);
}
