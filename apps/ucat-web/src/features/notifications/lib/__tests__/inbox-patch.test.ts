import { parseNotificationInboxPatch } from "../inbox-patch";

describe("notification inbox patch", () => {
  it("marks every visible item read", () => {
    expect(parseNotificationInboxPatch({ markAllRead: true })).toEqual({
      ok: true,
      patch: { type: "readAll" },
    });
  });

  it("reads, unreads, or dismisses the selected items", () => {
    expect(
      parseNotificationInboxPatch({ notificationIds: ["a", "a", "b"] }),
    ).toEqual({ ok: true, patch: { type: "read", ids: ["a", "b"] } });
    expect(
      parseNotificationInboxPatch({
        notificationIds: ["a"],
        markUnread: true,
      }),
    ).toEqual({ ok: true, patch: { type: "unread", ids: ["a"] } });
    expect(
      parseNotificationInboxPatch({
        notificationIds: ["a"],
        dismiss: true,
      }),
    ).toEqual({ ok: true, patch: { type: "dismiss", ids: ["a"] } });
  });

  it("rejects empty selections and mixed commands", () => {
    expect(parseNotificationInboxPatch({})).toEqual({
      ok: false,
      error: "No notifications selected",
    });
    expect(
      parseNotificationInboxPatch({ markAllRead: true, dismiss: true }),
    ).toEqual({
      ok: false,
      error: "Cannot dismiss all notifications",
    });
    expect(
      parseNotificationInboxPatch({ markAllRead: true, markUnread: true }),
    ).toEqual({
      ok: false,
      error: "Cannot unread all notifications",
    });
    expect(
      parseNotificationInboxPatch({
        notificationIds: ["a"],
        markUnread: true,
        dismiss: true,
      }),
    ).toEqual({
      ok: false,
      error: "Cannot unread and dismiss together",
    });
  });
});
