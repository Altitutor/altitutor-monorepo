import {
  founderInvitationCode,
  founderInvitationDestination,
} from "../invitation-path";
import { parseSignupPlanIntent } from "@/features/auth/lib/signup-plan-intent";

describe("founder signup return intent", () => {
  it("preserves a normalized gift without creating a checkout intent that skips the sampler", () => {
    const destination = founderInvitationDestination(" f-welcome ");
    expect(destination).toBe("/subscribe?offer=F-WELCOME");
    expect(founderInvitationCode(destination!)).toBe("F-WELCOME");
    expect(parseSignupPlanIntent(destination!)).toBeNull();
  });
  it("rejects invalid codes and ordinary return paths", () => {
    expect(founderInvitationDestination("bad code!")).toBeNull();
    expect(founderInvitationDestination(undefined)).toBeNull();
    expect(founderInvitationCode("/dashboard")).toBeNull();
  });
});
