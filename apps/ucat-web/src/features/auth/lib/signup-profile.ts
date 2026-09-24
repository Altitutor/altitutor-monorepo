export const PROFILE_SETUP_COMPLETE_KEY = "profile_setup_complete";

export function isProfileSetupComplete(
  userMetadata: Record<string, unknown> | undefined,
): boolean {
  return userMetadata?.[PROFILE_SETUP_COMPLETE_KEY] === true;
}
