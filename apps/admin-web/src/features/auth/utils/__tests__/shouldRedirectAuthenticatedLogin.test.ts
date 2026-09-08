import { shouldRedirectAuthenticatedLogin } from '../shouldRedirectAuthenticatedLogin';

describe('shouldRedirectAuthenticatedLogin', () => {
  it('does not bounce a signed-in student off login when portal access was denied', () => {
    expect(shouldRedirectAuthenticatedLogin('/login', true)).toBe(false);
  });

  it('still sends an authenticated admin away from a normal login visit', () => {
    expect(shouldRedirectAuthenticatedLogin('/login', false)).toBe(true);
  });

  it('does not redirect other public auth pages', () => {
    expect(shouldRedirectAuthenticatedLogin('/forgot-password', false)).toBe(false);
  });
});
