/** @jest-environment node */

import { upsertBlockProgress } from "@/lib/ucat/learning/progress-service";

describe("upsertBlockProgress", () => {
  it("uses one atomic RPC instead of select-then-insert", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: null });
    const from = jest.fn();

    await upsertBlockProgress(
      { rpc, from } as never,
      "student-1",
      "block-1",
      {
        interactionState: { answer: "A" },
        completed: true,
        manuallyCompleted: false,
      },
    );

    expect(rpc).toHaveBeenCalledWith(
      "upsert_ucat_learning_module_block_progress",
      {
        p_student_id: "student-1",
        p_learning_module_block_id: "block-1",
        p_interaction_state: { answer: "A" },
        p_completed: true,
        p_manually_completed: false,
      },
    );
    expect(from).not.toHaveBeenCalled();
  });
});
