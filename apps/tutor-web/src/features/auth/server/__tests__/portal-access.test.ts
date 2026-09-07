/** @jest-environment node */

import * as Sentry from "@sentry/nextjs";
import type { Database } from "@altitutor/shared";
import { createServerComponentClient } from "@/shared/lib/supabase/server-component";
import { loadTutorPortalAccess } from "../portal-access";

jest.mock("server-only", () => ({}));
jest.mock("react", () => ({
  ...jest.requireActual<typeof import("react")>("react"),
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));
jest.mock("@sentry/nextjs", () => ({ captureMessage: jest.fn() }));
jest.mock("@/shared/lib/supabase/server-component", () => ({
  createServerComponentClient: jest.fn(),
}));

type Profile = Database["public"]["Views"]["vtutor_profile"]["Row"];

const mockCreateServerComponentClient = jest.mocked(createServerComponentClient);
const mockCaptureMessage = jest.mocked(Sentry.captureMessage);
const mockMaybeSingle = jest.fn();

function profile(overrides: Partial<Profile>): Profile {
  return {
    id: "staff-1",
    first_name: "Trial",
    last_name: "Tutor",
    email: "trial.tutor@example.test",
    phone: null,
    role: "TUTOR",
    status: "TRIAL",
    user_id: "user-1",
    availability_monday: null,
    availability_tuesday: null,
    availability_wednesday: null,
    availability_thursday: null,
    availability_friday: null,
    availability_saturday_am: null,
    availability_saturday_pm: null,
    availability_sunday_am: null,
    availability_sunday_pm: null,
    created_at: "2026-09-05T00:00:00Z",
    updated_at: "2026-09-05T00:00:00Z",
    profile_bio: null,
    profile_image_file_id: null,
    birthday: null,
    ...overrides,
  };
}

describe("loadTutorPortalAccess", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockCreateServerComponentClient.mockResolvedValue({
      from: () => ({
        select: () => ({
          maybeSingle: mockMaybeSingle,
        }),
      }),
    } as never);
  });

  it("allows a trial tutor onto TutorWeb", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: profile({ status: "TRIAL", role: "TUTOR" }),
      error: null,
    });

    await expect(loadTutorPortalAccess("user-1")).resolves.toMatchObject({
      status: "allowed",
      userId: "user-1",
      profile: expect.objectContaining({ status: "TRIAL", role: "TUTOR" }),
    });
    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });

  it("allows an active tutor onto TutorWeb", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: profile({ status: "ACTIVE", role: "TUTOR" }),
      error: null,
    });

    await expect(loadTutorPortalAccess("user-1")).resolves.toMatchObject({
      status: "allowed",
      userId: "user-1",
    });
  });

  it("denies an inactive tutor instead of treating them as logged out", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: profile({ status: "INACTIVE", role: "TUTOR" }),
      error: null,
    });

    await expect(loadTutorPortalAccess("user-1")).resolves.toEqual({
      status: "denied",
    });
  });

  it("denies a session with no tutor profile", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(loadTutorPortalAccess("user-1")).resolves.toEqual({
      status: "denied",
    });
  });

  it("treats a missing verified identity as unauthenticated", async () => {
    await expect(loadTutorPortalAccess(null)).resolves.toEqual({
      status: "unauthenticated",
    });
    expect(mockCreateServerComponentClient).not.toHaveBeenCalled();
  });
});
