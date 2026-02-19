import type { Tables } from '@altitutor/shared';

export interface SubjectsSearchParams {
  curriculum?: string;
  yearLevel?: number | string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface SubjectsSearchResult {
  subjects: Tables<'subjects'>[];
  total: number;
}

export const subjectsSearchApi = {
  search: async (params: SubjectsSearchParams = {}): Promise<SubjectsSearchResult> => {
    const searchParams = new URLSearchParams();
    searchParams.set('limit', String(params.limit ?? 100));
    if (params.offset) searchParams.set('offset', String(params.offset));
    if (params.curriculum) searchParams.set('curriculums', params.curriculum);
    if (params.search?.trim()) searchParams.set('search', params.search.trim());
    if (params.yearLevel !== undefined && params.yearLevel !== null && params.yearLevel !== '') {
      let yearLevelNum: number;
      if (params.yearLevel === 'Reception') {
        yearLevelNum = 0;
      } else {
        yearLevelNum = typeof params.yearLevel === 'number' ? params.yearLevel : parseInt(String(params.yearLevel), 10);
      }
      // API uses year 12 for both 12 and 13
      if (yearLevelNum === 13) yearLevelNum = 12;
      searchParams.set('year_levels', String(yearLevelNum));
    }

    const response = await fetch(`/api/subjects/search?${searchParams.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch subjects');
    const data = await response.json();
    return {
      subjects: data.subjects || [],
      total: data.total ?? 0,
    };
  },
};
