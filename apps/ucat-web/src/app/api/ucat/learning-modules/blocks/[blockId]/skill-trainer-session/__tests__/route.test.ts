/** @jest-environment node */

import type { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireStudentAdminClient } from "@/lib/ucat/skill-trainer/api-auth";
import { GET } from "../route";

jest.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: jest.fn(),
}));
jest.mock("@/lib/ucat/skill-trainer/api-auth", () => ({
  requireStudentAdminClient: jest.fn(),
}));
jest.mock("@/lib/ucat/skill-trainer/queue", () => ({
  buildItemQueue: (ids: string[]) => ids,
}));
jest.mock("@/lib/sentry/capture-api-error", () => ({
  captureApiError: jest.fn(),
}));

const mockGetSupabaseServerClient = jest.mocked(getSupabaseServerClient);
const mockRequireStudentAdminClient = jest.mocked(requireStudentAdminClient);

function thenableResult<T>(value: T) {
  return {
    maybeSingle: jest.fn(async () => value),
    then: undefined as undefined,
  };
}

function createSelectChain(final: {
  maybeSingle?: () => Promise<{ data: unknown; error: unknown }>;
  is?: () => Promise<{ data: unknown; error: unknown }>;
}) {
  const chain: Record<string, jest.Mock> = {};
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.is = jest.fn(() =>
    final.is ? final.is() : thenableResult({ data: null, error: null }),
  );
  chain.maybeSingle = jest.fn(() =>
    final.maybeSingle
      ? final.maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  );
  return chain;
}

describe("GET /api/ucat/learning-modules/blocks/[blockId]/skill-trainer-session", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("resolves the trainer from skill_trainer_id without a trainerKey query param", async () => {
    const blockChain = createSelectChain({
      maybeSingle: async () => ({
        data: {
          id: "block-1",
          block_type: "skill_trainer",
          skill_trainer_id: "trainer-1",
        },
        error: null,
      }),
    });
    mockGetSupabaseServerClient.mockResolvedValue({
      from: jest.fn(() => blockChain),
    } as never);

    const trainerChain = createSelectChain({
      maybeSingle: async () => ({
        data: { id: "trainer-1", key: "numpad_speed", name: "Numpad speed" },
        error: null,
      }),
    });
    const itemsChain = createSelectChain({
      is: async () => ({
        data: [{ id: "item-1", content: { prompt: "1+1" } }],
        error: null,
      }),
    });
    const configChain = createSelectChain({
      maybeSingle: async () => ({
        data: {
          time_limit_seconds: 60,
          points_correct: 1,
          points_wrong: -1,
          streak_multiplier_steps: [],
          speed_bonus_enabled: false,
          speed_bonus_max_points: 0,
          speed_bonus_window_seconds: 8,
        },
        error: null,
      }),
    });

    mockRequireStudentAdminClient.mockResolvedValue({
      ok: true,
      userId: "user-1",
      studentId: "student-1",
      timezone: "Australia/Adelaide",
      admin: {
        from: jest.fn((table: string) => {
          if (table === "ucat_skill_trainers") return trainerChain;
          if (table === "ucat_skill_trainer_items") return itemsChain;
          if (table === "ucat_skill_trainer_config") return configChain;
          throw new Error(`Unexpected table ${table}`);
        }),
      },
    } as never);

    const response = await GET({} as NextRequest, {
      params: Promise.resolve({ blockId: "block-1" }),
    });
    const json = (await response.json()) as {
      trainerName: string;
      session: { attempt: { trainer_key: string; skill_trainer_id: string } };
    };

    expect(response.status).toBe(200);
    expect(json.trainerName).toBe("Numpad speed");
    expect(json.session.attempt.trainer_key).toBe("numpad_speed");
    expect(json.session.attempt.skill_trainer_id).toBe("trainer-1");
  });

  it("returns 404 when the block has no skill_trainer_id", async () => {
    const blockChain = createSelectChain({
      maybeSingle: async () => ({
        data: {
          id: "block-1",
          block_type: "skill_trainer",
          skill_trainer_id: null,
        },
        error: null,
      }),
    });
    mockGetSupabaseServerClient.mockResolvedValue({
      from: jest.fn(() => blockChain),
    } as never);
    mockRequireStudentAdminClient.mockResolvedValue({
      ok: true,
      userId: "user-1",
      studentId: "student-1",
      timezone: "Australia/Adelaide",
      admin: { from: jest.fn() },
    } as never);

    const response = await GET({} as NextRequest, {
      params: Promise.resolve({ blockId: "block-1" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Skill trainer block not found",
    });
  });
});
