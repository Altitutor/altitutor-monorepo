import { act, renderHook } from "@testing-library/react";
import React, { type ReactNode } from "react";
import {
  StudyPlanCompanionProvider,
  useStudyPlanCompanion,
} from "../study-plan-companion-context";

function wrapper({ children }: { children: ReactNode }) {
  return <StudyPlanCompanionProvider>{children}</StudyPlanCompanionProvider>;
}

describe("StudyPlanCompanionProvider activity completions", () => {
  it("keeps a completion event after the activity visibility flag resets", () => {
    const { result } = renderHook(() => useStudyPlanCompanion(), { wrapper });

    act(() => {
      result.current.setActivityComplete(true);
      result.current.reportActivityCompletion({
        title: "Skill trainer complete",
        detail: "42 points scored",
      });
      result.current.setActivityComplete(false);
    });

    expect(result.current.activityComplete).toBe(false);
    expect(result.current.activityCompletion).toEqual({
      id: 1,
      title: "Skill trainer complete",
      detail: "42 points scored",
    });
  });

  it("only consumes the matching completion event", () => {
    const { result } = renderHook(() => useStudyPlanCompanion(), { wrapper });

    act(() => {
      result.current.reportActivityCompletion({ title: "Task complete" });
    });
    act(() => result.current.consumeActivityCompletion(999));
    expect(result.current.activityCompletion?.id).toBe(1);

    act(() => result.current.consumeActivityCompletion(1));
    expect(result.current.activityCompletion).toBeNull();
  });
});
