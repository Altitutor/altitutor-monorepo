import { loginErrorMessage } from '../loginErrorMessage';

describe('loginErrorMessage', () => {
  it('explains access_denied instead of showing the raw query value', () => {
    expect(loginErrorMessage('access_denied')).toBe(
      'This admin portal is for Altitutor staff. Sign in with a staff account, or use the student or tutor site.',
    );
  });

  it('decodes other login errors', () => {
    expect(loginErrorMessage('Invalid%20login%20credentials')).toBe(
      'Invalid login credentials',
    );
  });

  it('returns null when there is no error', () => {
    expect(loginErrorMessage(null)).toBeNull();
  });
});
