import { act, renderHook } from "@testing-library/react";
import type { InterviewTemplate } from "@altitutor/shared";
import { useBuilderDraft } from "../use-builder-draft";

const original: InterviewTemplate = {
  id: "interview",
  version: 1,
  name: "Original",
  readingTimeSeconds: 60,
  questionTimeSeconds: 180,
  recordingEnabled: false,
  stations: [],
  archived: false,
  updatedAt: "",
};
beforeEach(() => sessionStorage.clear());

test("leaving and returning restores only the same actor's interview draft", () => {
  const first = renderHook(() => useBuilderDraft("tutor-a", original));
  act(() =>
    first.result.current.change({ ...original, name: "Unfinished edit" }),
  );
  first.unmount();
  const other = renderHook(() => useBuilderDraft("tutor-b", original));
  expect(other.result.current.draft.name).toBe("Original");
  const returned = renderHook(() => useBuilderDraft("tutor-a", original));
  expect(returned.result.current.draft.name).toBe("Unfinished edit");
  expect(returned.result.current.recovered).toBe(true);
});

test("a newer server revision preserves the draft and requires explicit discard", () => {
  const { result, rerender } = renderHook(
    ({ server }) => useBuilderDraft("tutor", server),
    { initialProps: { server: original } },
  );
  act(() => result.current.change({ ...original, name: "Mine" }));
  rerender({
    server: { ...original, version: 2, name: "Another tutor's edit" },
  });
  expect(result.current.conflict).toBe(true);
  expect(result.current.version).toBe(1);
  expect(result.current.draft.name).toBe("Mine");
  act(() => result.current.discard());
  expect(result.current.draft.name).toBe("Another tutor's edit");
  expect(result.current.dirty).toBe(false);
});

test("acknowledging an older submission retains edits made while saving", () => {
  const { result } = renderHook(() => useBuilderDraft("tutor", original));
  const submitted = { ...original, name: "Submitted" };
  act(() => result.current.change(submitted));
  act(() => result.current.change({ ...submitted, name: "Later edit" }));
  act(() => result.current.saved(2, submitted));
  expect(result.current.draft.name).toBe("Later edit");
  expect(result.current.dirty).toBe(true);
  expect(result.current.version).toBe(2);
});
