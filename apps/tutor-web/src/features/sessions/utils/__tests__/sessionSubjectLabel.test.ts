import { formatPersonDisplayName, formatTutorSessionSubjectLabel } from '../sessionSubjectLabel';

describe('formatTutorSessionSubjectLabel', () => {
  it('joins curriculum, year, name, and class level', () => {
    expect(
      formatTutorSessionSubjectLabel({
        subject_curriculum: 'SACE',
        subject_year_level: 12,
        subject_name: 'Mathematics',
        class_level: 'Methods',
      }),
    ).toBe('SACE Year 12 Mathematics Methods');
  });

  it('falls back to short name then session type', () => {
    expect(
      formatTutorSessionSubjectLabel({
        short_name: 'Check-in',
        session_type: 'CHECK_IN',
      }),
    ).toBe('Check-in');
    expect(
      formatTutorSessionSubjectLabel({
        session_type: 'CHECK_IN',
      }),
    ).toBe('Check In');
  });

  it('returns an em dash when nothing is available', () => {
    expect(formatTutorSessionSubjectLabel({})).toBe('—');
    expect(formatTutorSessionSubjectLabel({ session_type: 'CLASS' })).toBe('—');
  });
});

describe('formatPersonDisplayName', () => {
  it('joins first and last name', () => {
    expect(formatPersonDisplayName({ first_name: 'Ada', last_name: 'Lovelace' })).toBe(
      'Ada Lovelace',
    );
  });

  it('ignores empty parts', () => {
    expect(formatPersonDisplayName({ first_name: 'Ada', last_name: null })).toBe('Ada');
    expect(formatPersonDisplayName({ first_name: '', last_name: '' })).toBe('');
  });
});
