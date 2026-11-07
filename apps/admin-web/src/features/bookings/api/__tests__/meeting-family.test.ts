import { getMeetingFamilySuggestions } from '../meeting-family';

jest.mock('@/shared/lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    from: () => ({
      select: (selection: string) => ({
        in: async (_column: string, ids: string[]) => ({
          error: null,
          data: selection.startsWith('parent:')
            ? [{ parent: { id: 'shared-parent' } }, { parent: { id: 'shared-parent' } }]
            : ids.includes('shared-parent')
              ? [
                  { student: { id: 'selected-student', deleted_at: null } },
                  { student: { id: 'sibling', deleted_at: null } },
                  { student: { id: 'sibling', deleted_at: null } },
                  { student: { id: 'retired-sibling', deleted_at: '2026-10-01' } },
                ]
              : [],
        }),
      }),
    }),
  }),
}));

it('suggests a sibling without adding the shared parent to the meeting roster', async () => {
  const suggestions = await getMeetingFamilySuggestions(['selected-student'], []);
  expect(suggestions.parents.map(row => row.id)).toEqual(['shared-parent']);
  expect(suggestions.students.map(row => row.id)).toEqual(['sibling']);
});

it('suggests related Students when their Parent is already selected', async () => {
  const suggestions = await getMeetingFamilySuggestions(['selected-student'], ['shared-parent']);
  expect(suggestions.parents).toEqual([]);
  expect(suggestions.students.map(row => row.id)).toEqual(['sibling']);
});
