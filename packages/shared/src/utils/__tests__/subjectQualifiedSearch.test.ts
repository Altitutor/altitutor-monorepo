import {
  looksLikeTopicOrFileCode,
  parseSubjectQualifiedSearch,
} from '../ilike';

describe('looksLikeTopicOrFileCode', () => {
  it('accepts numeric topic codes', () => {
    expect(looksLikeTopicOrFileCode('2.2')).toBe(true);
  });

  it('accepts short resource codes', () => {
    expect(looksLikeTopicOrFileCode('w1')).toBe(true);
  });

  it('rejects long plain words', () => {
    expect(looksLikeTopicOrFileCode('introduction')).toBe(false);
  });
});

describe('parseSubjectQualifiedSearch', () => {
  it('parses subject and topic code', () => {
    expect(parseSubjectQualifiedSearch('12CHEM 2.2')).toEqual({
      mode: 'qualified',
      subjectQuery: '12CHEM',
      codeQuery: '2.2',
    });
  });

  it('supports multi-word subject names', () => {
    expect(parseSubjectQualifiedSearch('Year 12 Chemistry 2.2')).toEqual({
      mode: 'qualified',
      subjectQuery: 'Year 12 Chemistry',
      codeQuery: '2.2',
    });
  });

  it('falls back to general search without a code segment', () => {
    expect(parseSubjectQualifiedSearch('bio introduction')).toEqual({
      mode: 'general',
      query: 'bio introduction',
    });
  });

  it('falls back for single-token searches', () => {
    expect(parseSubjectQualifiedSearch('12CHEM')).toEqual({
      mode: 'general',
      query: '12CHEM',
    });
  });
});
