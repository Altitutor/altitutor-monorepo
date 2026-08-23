import { useMemo } from 'react';
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess';
import { useResourceSubjectNavItems } from '@/features/resources/hooks/useResources';
import {
  buildSubjectPages,
  staticPages,
  ucatPages,
  type CommandPalettePage,
} from '../config/commandPalette.config';

export function useCommandPalettePages(): CommandPalettePage[] {
  const { data: subjects } = useResourceSubjectNavItems();
  const ucatAccess = useUcatAccess();
  const isUcatTutor = Boolean(ucatAccess.data);

  return useMemo(() => {
    const subjectPages = buildSubjectPages(subjects ?? []);
    const pages = [...staticPages, ...subjectPages];
    if (isUcatTutor) pages.push(...ucatPages);
    return pages;
  }, [subjects, isUcatTutor]);
}
