const ACCESS_DENIED_MESSAGE =
  'This admin portal is for Altitutor staff. Sign in with a staff account, or use the student or tutor site.';

export function loginErrorMessage(error: string | null): string | null {
  if (!error) return null;
  if (error === 'access_denied') return ACCESS_DENIED_MESSAGE;
  try {
    return decodeURIComponent(error);
  } catch {
    return error;
  }
}
