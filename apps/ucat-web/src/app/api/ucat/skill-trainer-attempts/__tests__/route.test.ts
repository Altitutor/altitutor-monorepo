/** @jest-environment node */

import type { NextRequest } from "next/server";
import { captureApiError } from "@/lib/sentry/capture-api-error";
import { requireUserAdminClient } from "@/lib/ucat/skill-trainer/api-auth";
import { startSkillTrainerAttempt } from "@/lib/ucat/skill-trainer/attempt-service";
import { POST } from "../route";

jest.mock("@/lib/sentry/capture-api-error", () => ({
  captureApiError: jest.fn(),
}));
jest.mock("@/lib/ucat/skill-trainer/api-auth", () => ({
  requireUserAdminClient: jest.fn(),
}));
jest.mock("@/lib/ucat/skill-trainer/attempt-service", () => ({
  startSkillTrainerAttempt: jest.fn(),
}));

const mockCaptureApiError = jest.mocked(captureApiError);
const mockRequireUserAdminClient = jest.mocked(requireUserAdminClient);
const mockStartSkillTrainerAttempt = jest.mocked(startSkillTrainerAttempt);

describe("POST /api/ucat/skill-trainer-attempts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireUserAdminClient.mockResolvedValue({
      ok: true,
      admin: {},
      userId: "user-1",
    } as never);
  });

  it("returns an expected missing-trainer response without reporting an exception", async () => {
    mockStartSkillTrainerAttempt.mockRejectedValue(
      new Error("TRAINER_NOT_FOUND"),
    );

    const response = await POST({
      json: async () => ({ trainerKey: "decision-making-syllogisms" }),
    } as unknown as NextRequest);

    expect(response.status).toBe(404);
    expect(mockCaptureApiError).not.toHaveBeenCalled();
  });

  it("still reports unexpected failures", async () => {
    const error = new Error("Database unavailable");
    mockStartSkillTrainerAttempt.mockRejectedValue(error);

    const response = await POST({
      json: async () => ({ trainerKey: "decision-making-syllogisms" }),
    } as unknown as NextRequest);

    expect(response.status).toBe(500);
    expect(mockCaptureApiError).toHaveBeenCalledWith(
      error,
      "/api/ucat/skill-trainer-attempts",
    );
  });
});
