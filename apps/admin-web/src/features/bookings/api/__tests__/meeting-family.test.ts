import { getMeetingFamilySuggestions } from '../meeting-family';

jest.mock('@/shared/lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    from: () => ({ select: (selection: string) => ({ in: async () => ({ error: null, data: selection.startsWith('parent:') ? [
      { parent: { id: 'selected-parent' } }, { parent: { id: 'suggested-parent' } }, { parent: { id: 'suggested-parent' } },
    ] : [
      { student: { id: 'selected-student', deleted_at: null } }, { student: { id: 'suggested-student', deleted_at: null } }, { student: { id: 'retired-student', deleted_at: '2026-10-01' } },
    ] }) }) }),
  }),
}));
it('suggests related people in both directions without duplicates or selected/retired people', async () => {
  const suggestions = await getMeetingFamilySuggestions(['selected-student'], ['selected-parent']);
  expect(suggestions.parents.map(row => row.id)).toEqual(['suggested-parent']);
  expect(suggestions.students.map(row => row.id)).toEqual(['suggested-student']);
});
