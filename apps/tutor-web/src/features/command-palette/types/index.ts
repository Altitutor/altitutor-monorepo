import type { Database } from '@altitutor/shared';

type TutorSubjectRow = Database['public']['Views']['vtutor_subjects']['Row'] & { id: string };
type TutorTopicRow = Database['public']['Views']['vtutor_topics']['Row'] & { id: string };
type TutorClassRow = Database['public']['Views']['vtutor_classes']['Row'] & { id: string };

export type TutorSubjectSummary = Pick<
  TutorSubjectRow,
  'id' | 'short_name' | 'long_name' | 'name' | 'color' | 'curriculum'
>;

export type TutorCommandPaletteEntityResult =
  | { type: 'subject'; id: string; href: string; data: TutorSubjectRow }
  | {
      type: 'topic';
      id: string;
      href: string;
      data: TutorTopicRow & { subject: TutorSubjectSummary };
    }
  | {
      type: 'file';
      id: string;
      href: string;
      data: {
        id: string;
        topic_id: string;
        code: string;
        type: string;
        filename: string | null;
        topic: { id: string; code: string | null; name: string | null };
        subject: TutorSubjectSummary;
      };
    }
  | {
      type: 'flashcards';
      id: string;
      href: string;
      data: {
        topic: { id: string; code: string | null; name: string | null };
        subject: TutorSubjectSummary;
      };
    }
  | { type: 'class'; id: string; href: string; data: TutorClassRow };

import type { FilterType } from '../utils/filtering';

export interface UseCommandPaletteSearchOptions {
  search: string;
  enabled?: boolean;
  selectedFilters: FilterType[];
  allFilterTypes: FilterType[];
}
