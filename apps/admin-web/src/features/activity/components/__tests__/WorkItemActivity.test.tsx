import { render, screen } from "@testing-library/react";
import { WorkItemActivity } from "../WorkItemActivity";
import { useEntityActivityNoteComposer } from "../../hooks/useEntityActivityNoteComposer";
jest.mock("../../hooks/useEntityActivityNoteComposer", () => ({
  useEntityActivityNoteComposer: jest.fn(() => ({})),
}));
jest.mock("../ActivityFeed", () => ({
  ActivityFeed: ({ chronological }: { chronological: boolean }) => (
    <div data-testid="feed">
      {chronological ? "Oldest first" : "Newest first"}
    </div>
  ),
}));
jest.mock("../ActivityNoteComposer", () => ({
  ActivityNoteComposer: () => <div data-testid="composer">Add a note</div>,
}));
test.each(["task", "issue", "project"] as const)(
  "%s has one Activity section with its composer after the chronological feed",
  (kind) => {
    render(<WorkItemActivity kind={kind} entityId="record-one" />);
    expect(screen.getAllByRole("heading", { name: "Activity" })).toHaveLength(
      1,
    );
    const feed = screen.getByTestId("feed");
    expect(feed).toHaveTextContent("Oldest first");
    expect(
      feed.compareDocumentPosition(screen.getByTestId("composer")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(useEntityActivityNoteComposer).toHaveBeenLastCalledWith({
      targetType: `${kind}s`,
      targetId: "record-one",
      activityQueryKey: ["activity", kind, "record-one"],
    });
  },
);
