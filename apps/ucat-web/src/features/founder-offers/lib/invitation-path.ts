import { normalizeUcatInvitationCode } from "@altitutor/shared";

/** Carry the offer in return intent through OTP, login and the sampler. */
export function founderInvitationCode(path: string): string | null {
  const code = normalizeUcatInvitationCode(
    new URL(path, "https://ucat.altitutor.com").searchParams.get("offer"),
  );
  return code;
}

export function founderInvitationDestination(rawCode: unknown): string | null {
  const code = normalizeUcatInvitationCode(rawCode);
  return code
    ? `/subscribe?offer=${encodeURIComponent(code)}`
    : null;
}
