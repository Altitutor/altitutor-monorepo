/** @jest-environment node */

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { VERIFIED_USER_ID_HEADER } from "@altitutor/shared";
import AppEntryRedirect from "@/app/page";
import { loadUcatPortalAccess } from "@/features/auth/server/portal-access";

jest.mock("next/headers", () => ({ headers: jest.fn() }));
jest.mock("next/navigation", () => ({ redirect: jest.fn() }));
jest.mock("@/features/auth/server/portal-access", () => ({
  loadUcatPortalAccess: jest.fn(),
}));

const mockHeaders = jest.mocked(headers);
const mockRedirect = jest.mocked(redirect);
const mockLoadUcatPortalAccess = jest.mocked(loadUcatPortalAccess);

describe("AppEntryRedirect", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHeaders.mockResolvedValue(
      new Headers({ [VERIFIED_USER_ID_HEADER]: "student-user" }) as never,
    );
    mockLoadUcatPortalAccess.mockResolvedValue({
      status: "allowed",
      userId: "student-user",
      access: { activeStaffRole: null, signupCompleted: true },
    } as never);
    mockRedirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  it("reuses the identity already verified by middleware", async () => {
    await expect(AppEntryRedirect()).rejects.toThrow("NEXT_REDIRECT");

    expect(mockLoadUcatPortalAccess).toHaveBeenCalledWith("student-user");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });
});
