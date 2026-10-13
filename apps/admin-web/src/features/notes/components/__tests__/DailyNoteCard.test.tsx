import { act, fireEvent, render, screen } from "@testing-library/react";
import type { JSONContent } from "@altitutor/ui";
import { DailyNoteCard } from "../DailyNoteCard";

const mutate = jest.fn();

jest.mock("../../api/dailyQueries", () => ({
  useDailyNote: () => ({
    data: { id: "daily-note-1", content: "" },
    isLoading: false,
  }),
  useUpdateDailyNote: () => ({
    mutate,
    isPending: false,
    isError: false,
  }),
}));

jest.mock("@/shared/hooks", () => ({
  ...jest.requireActual("@/shared/hooks"),
  useCurrentStaff: () => ({ data: { id: "staff-1" } }),
}));

jest.mock("@/shared/hooks/useMentionSuggestions", () => ({
  useMentionSuggestions: () => undefined,
}));

jest.mock("../NoteEditor", () => ({
  NoteEditor: ({
    onChange,
    onChangeDebounceMs = 200,
  }: {
    onChange: (content: JSONContent) => void;
    onChangeDebounceMs?: number;
  }) => (
    <button
      type="button"
      onClick={() => {
        const next = {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Remember this" }],
            },
          ],
        };
        if (onChangeDebounceMs === 0) onChange(next);
        else setTimeout(() => onChange(next), onChangeDebounceMs);
      }}
    >
      Type note
    </button>
  ),
}));

describe("DailyNoteCard autosave", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mutate.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("persists the latest edit when the card closes before the idle save", () => {
    const { unmount } = render(<DailyNoteCard date="2026-10-13" />);

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Type note" }));
    });
    unmount();

    expect(mutate).toHaveBeenCalledWith(
      {
        id: "daily-note-1",
        date: "2026-10-13",
        updates: {
          content: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Remember this" }],
              },
            ],
          },
        },
        silent: true,
        updatedBy: "staff-1",
      },
      expect.any(Object),
    );
  });

  it("waits for the idle save instead of persisting every editor change", () => {
    const { unmount } = render(<DailyNoteCard date="2026-10-13" />);

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Type note" }));
    });
    expect(mutate).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(999);
    });
    expect(mutate).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(mutate).toHaveBeenCalledTimes(1);

    unmount();
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("keeps a failed edit eligible for a final save when the card closes", () => {
    const { unmount } = render(<DailyNoteCard date="2026-10-13" />);

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Type note" }));
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    const mutationOptions = mutate.mock.calls[0]?.[1] as
      | { onError?: () => void }
      | undefined;
    act(() => {
      mutationOptions?.onError?.();
    });
    unmount();

    expect(mutate).toHaveBeenCalledTimes(2);
  });
});
