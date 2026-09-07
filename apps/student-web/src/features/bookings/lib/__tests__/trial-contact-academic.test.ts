import {
  curriculumAfterYearLevelChange,
  formatSubjectWithYearContext,
  impliedCurriculumForYearLevel,
  yearLevelNeedsCurriculumChoice,
} from '../trial-contact-academic';

describe('trial contact academic fields', () => {
  it('only asks for curriculum in years 11-13', () => {
    expect(yearLevelNeedsCurriculumChoice('10')).toBe(false);
    expect(yearLevelNeedsCurriculumChoice('11')).toBe(true);
    expect(yearLevelNeedsCurriculumChoice('12')).toBe(true);
    expect(yearLevelNeedsCurriculumChoice('13')).toBe(true);
    expect(yearLevelNeedsCurriculumChoice(undefined)).toBe(false);
  });

  it('implies curriculum for years that have only one option', () => {
    expect(impliedCurriculumForYearLevel('Reception')).toBe('PRIMARY');
    expect(impliedCurriculumForYearLevel('6')).toBe('PRIMARY');
    expect(impliedCurriculumForYearLevel('7')).toBe('PRESACE');
    expect(impliedCurriculumForYearLevel('10')).toBe('PRESACE');
    expect(impliedCurriculumForYearLevel('11')).toBeNull();
  });

  it('keeps SACE or IB when moving between senior years', () => {
    expect(curriculumAfterYearLevelChange('12', 'IB')).toBe('IB');
    expect(curriculumAfterYearLevelChange('10', 'IB')).toBe('PRESACE');
    expect(curriculumAfterYearLevelChange('11', 'PRESACE')).toBeUndefined();
    expect(curriculumAfterYearLevelChange(undefined, 'SACE')).toBeUndefined();
  });

  it('labels another-year subjects with curriculum and year', () => {
    expect(
      formatSubjectWithYearContext({
        curriculum: 'SACE',
        year_level: 12,
        name: 'Chemistry',
        short_name: null,
        long_name: 'Chemistry',
      }),
    ).toBe('SACE Year 12 Chemistry');
  });
});
