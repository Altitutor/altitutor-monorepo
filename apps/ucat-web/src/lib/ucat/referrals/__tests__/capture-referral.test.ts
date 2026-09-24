import type { User } from "@supabase/supabase-js";
import { pendingReferralCodeFromUser } from "@/lib/ucat/referrals/capture-referral";

function userWithMetadata(user_metadata: Record<string, unknown>): User {
  return { user_metadata } as User;
}

describe("pendingReferralCodeFromUser", () => {
  it("normalizes a valid referral code", () => {
    expect(
      pendingReferralCodeFromUser(
        userWithMetadata({ pending_referral_code: "  abc12345  " }),
      ),
    ).toBe("ABC12345");
  });

  it("rejects malformed or non-string metadata", () => {
    expect(
      pendingReferralCodeFromUser(
        userWithMetadata({ pending_referral_code: "not-a-code" }),
      ),
    ).toBeNull();
    expect(
      pendingReferralCodeFromUser(
        userWithMetadata({ pending_referral_code: 12345678 }),
      ),
    ).toBeNull();
  });
});
