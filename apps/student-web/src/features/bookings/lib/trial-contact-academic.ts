export const TRIAL_YEAR_LEVELS = [
  'Reception',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '13',
] as const;

export type TrialYearLevel = (typeof TRIAL_YEAR_LEVELS)[number];
export type TrialCurriculum = 'SACE' | 'IB' | 'PRESACE' | 'PRIMARY';

export const SENIOR_CURRICULUMS: readonly TrialCurriculum[] = ['SACE', 'IB'];

export function parseTrialYearLevel(yearLevel: string | undefined): number | null {
  if (!yearLevel) return null;
  if (yearLevel === 'Reception') return 0;
  const parsed = Number.parseInt(yearLevel, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

export function yearLevelNeedsCurriculumChoice(yearLevel: string | undefined): boolean {
  const year = parseTrialYearLevel(yearLevel);
  return year !== null && year >= 11 && year <= 13;
}

export function impliedCurriculumForYearLevel(
  yearLevel: string | undefined,
): 'PRESACE' | 'PRIMARY' | null {
  const year = parseTrialYearLevel(yearLevel);
  if (year === null) return null;
  if (year >= 7 && year <= 10) return 'PRESACE';
  if (year >= 0 && year <= 6) return 'PRIMARY';
  return null;
}

export function curriculumAfterYearLevelChange(
  yearLevel: string | undefined,
  currentCurriculum: TrialCurriculum | undefined,
): TrialCurriculum | undefined {
  const implied = impliedCurriculumForYearLevel(yearLevel);
  if (implied) return implied;
  if (!yearLevelNeedsCurriculumChoice(yearLevel)) return undefined;
  if (currentCurriculum === 'SACE' || currentCurriculum === 'IB') return currentCurriculum;
  return undefined;
}

export function formatSubjectWithYearContext(subject: {
  name: string | null;
  short_name: string | null;
  long_name: string | null;
  curriculum: string | null;
  year_level: number | null;
}): string {
  const name = subject.long_name || subject.short_name || subject.name || '';
  const year =
    subject.year_level === 0
      ? 'Reception'
      : subject.year_level != null
        ? `Year ${subject.year_level}`
        : null;
  return [subject.curriculum, year, name].filter(Boolean).join(' ');
}
