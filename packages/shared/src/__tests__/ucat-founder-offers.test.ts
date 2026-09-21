import { normalizeUcatInvitationCode, parseUcatFounderOffer } from '../ucat-founder-offers';
const valid = { code: ' f-friends ', name: 'Friends', campaign: 'founders', kind: 'access_pass', duration_unit: 'week', duration_count: 2, max_redemptions: 1 };
describe('founder offer input boundary', () => {
  it('normalizes invitation codes with or without an F- prefix', () => {
    expect(normalizeUcatInvitationCode(' f-friends ')).toBe('F-FRIENDS');
    expect(normalizeUcatInvitationCode('abcd1234')).toBe('ABCD1234');
    expect(normalizeUcatInvitationCode(' launch ')).toBe('LAUNCH');
    expect(parseUcatFounderOffer({ ...valid, code: 'LAUNCH' })?.code).toBe('LAUNCH');
    expect(parseUcatFounderOffer({ ...valid, code: 'ABCD1234' })?.code).toBe('ABCD1234');
  });
  it('rejects codes that are too short or start with a hyphen', () => {
    expect(normalizeUcatInvitationCode('AB')).toBeNull();
    expect(normalizeUcatInvitationCode('-LAUNCH')).toBeNull();
    expect(parseUcatFounderOffer({ ...valid, code: 'AB' })).toBeNull();
  });
  it('represents unlimited redemptions explicitly, not as zero', () => {
    expect(parseUcatFounderOffer({ ...valid, max_redemptions: null })?.max_redemptions).toBeNull();
    expect(parseUcatFounderOffer({ ...valid, max_redemptions: 0 })).toBeNull();
  });
  it.each([0, -1, 1.5, 101, NaN])('rejects invalid percentage %s', percent_off => {
    expect(parseUcatFounderOffer({ ...valid, kind: 'discount', percent_off })).toBeNull();
  });
  it('discards irrelevant benefit fields and validates calendar-month duration', () => {
    expect(parseUcatFounderOffer({ ...valid, kind: 'discount', percent_off: 20 })).toMatchObject({ percent_off: 20, duration_unit: null, duration_count: null });
    expect(parseUcatFounderOffer({ ...valid, duration_unit: 'month' })).toMatchObject({ duration_unit: 'month', duration_count: 2 });
    expect(parseUcatFounderOffer({ ...valid, duration_count: 0 })).toBeNull();
    expect(parseUcatFounderOffer({ ...valid, duration_unit: 'month', duration_count: 23 })).not.toBeNull();
    expect(parseUcatFounderOffer({ ...valid, duration_unit: 'month', duration_count: 24 })).toBeNull();
  });
  it('rejects expired offers and invalid dates', () => {
    expect(parseUcatFounderOffer({ ...valid, expires_at: 'yesterday' })).toBeNull();
    expect(parseUcatFounderOffer({ ...valid, expires_at: '2000-01-01' })).toBeNull();
  });
});
