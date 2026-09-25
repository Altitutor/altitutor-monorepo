import {
  buildCodeAndFilenameOrFilter,
  buildCodeAndNameOrFilter,
  buildCodeExactOrPrefixOrFilter,
  buildPersonFieldOrFilters,
  buildSubjectNameOrFilter,
  looksLikeTopicOrFileCode,
  parseSubjectQualifiedSearch,
  quotePostgrestFilterValue,
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

describe('PostgREST filter builders', () => {
  it('quotes reserved characters in subject name filters', () => {
    expect(buildSubjectNameOrFilter('12CHEM')).toBe(
      `short_name.ilike.${quotePostgrestFilterValue('%12CHEM%')},long_name.ilike.${quotePostgrestFilterValue('%12CHEM%')},name.ilike.${quotePostgrestFilterValue('%12CHEM%')}`,
    );
  });

  it('quotes dotted codes in code/name filters', () => {
    expect(buildCodeAndNameOrFilter('code', 'name', '2.2')).toBe(
      `code.ilike.${quotePostgrestFilterValue('2.2')},code.ilike.${quotePostgrestFilterValue('2.2%')},name.ilike.${quotePostgrestFilterValue('%2.2%')}`,
    );
  });

  it('quotes dotted codes in code/filename filters', () => {
    expect(buildCodeAndFilenameOrFilter('code', 'filename', '2.2')).toBe(
      `code.ilike.${quotePostgrestFilterValue('2.2')},code.ilike.${quotePostgrestFilterValue('2.2%')},filename.ilike.${quotePostgrestFilterValue('%2.2%')}`,
    );
  });

  it('matches a full name by requiring every word against any name field', () => {
    const [first, last] = buildPersonFieldOrFilters('John Doe', ['first_name', 'last_name', 'email', 'phone']);
    const john = quotePostgrestFilterValue('%John%');
    const doe = quotePostgrestFilterValue('%Doe%');
    expect(first).toBe(
      `first_name.ilike.${john},last_name.ilike.${john},email.ilike.${john},phone.ilike.${john}`,
    );
    expect(last).toBe(
      `first_name.ilike.${doe},last_name.ilike.${doe},email.ilike.${doe},phone.ilike.${doe}`,
    );
  });

  it('keeps a single name as one field group', () => {
    expect(buildPersonFieldOrFilters('Doe', ['first_name', 'last_name'])).toEqual([
      `first_name.ilike.${quotePostgrestFilterValue('%Doe%')},last_name.ilike.${quotePostgrestFilterValue('%Doe%')}`,
    ]);
  });

  it('builds code-only or filters for nested filename searches', () => {
    expect(buildCodeExactOrPrefixOrFilter('code', '2.2')).toBe(
      `code.ilike.${quotePostgrestFilterValue('2.2')},code.ilike.${quotePostgrestFilterValue('2.2%')}`,
    );
  });
});
