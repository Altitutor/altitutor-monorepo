import { getUcatSessionsUrl, isUcatSubject } from '../ucat-resources';

describe('UCAT resources navigation', () => {
  it('recognises UCAT subjects case-insensitively', () => {
    expect(
      isUcatSubject({ name: 'MEDICINEUCAT', short_name: 'UCAT', long_name: 'MEDICINEUCAT' })
    ).toBe(true);
    expect(isUcatSubject({ name: null, short_name: 'ucat', long_name: null })).toBe(true);
  });

  it('does not treat other subjects as UCAT', () => {
    expect(
      isUcatSubject({
        name: 'Mathematics',
        short_name: 'MATH',
        long_name: 'Mathematics',
      })
    ).toBe(false);
  });

  it('builds a login URL that continues to UCAT sessions', () => {
    expect(getUcatSessionsUrl('https://ucat.example.com/base')).toBe(
      'https://ucat.example.com/login?redirect=%2Fsessions'
    );
  });
});
