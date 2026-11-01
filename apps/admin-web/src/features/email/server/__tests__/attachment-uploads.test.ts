/** @jest-environment node */
import { attachmentUploads, type DraftUploadLock } from "../attachment-uploads";
import { createGraphMailbox } from "../graph";
jest.mock("server-only", () => ({}));

it("binds an encrypted upload ticket to staff and the draft lock, rejecting tampering and simultaneous editors", async () => {
  let token = "editor";
  let writing = false;
  const lock: DraftUploadLock = {
    start: async (_id, _version, editor, upload) => {
      if (writing || token !== editor) return false;
      token = upload;
      writing = true;
      return true;
    },
    move: async (_id, from, to, _expires, hold) => {
      if (token !== from || !writing) return false;
      token = to;
      writing = hold;
      return true;
    },
  };
  const requests: string[] = [];
  const mailbox = createGraphMailbox({
    mailbox: {
      environment: "development",
      address: "admin@development.altitutor.com",
      allowedRecipients: [],
    },
    accessToken: "fixture-token",
    fetchImpl: async (input, init) => {
      const url = String(input);
      requests.push(url);
      if (url.includes("createUploadSession"))
        return Response.json(
          {
            uploadUrl:
              "https://outlook.office.com/api/v2.0/upload?authtoken=private-fixture-capability",
            expirationDateTime: new Date(Date.now() + 600_000).toISOString(),
          },
          { status: 201 },
        );
      if (init?.method === "PUT")
        return new Response(null, {
          status: 201,
          headers: {
            Location:
              "https://outlook.office.com/api/v2.0/Attachments('uploaded-file')",
          },
        });
      if (url.includes("/attachments")) return Response.json({ value: [] });
      return Response.json({
        id: "draft",
        conversationId: "thread",
        isDraft: true,
        changeKey: "one",
        toRecipients: [],
        ccRecipients: [],
        bccRecipients: [],
      });
    },
  });
  const uploads = attachmentUploads({
    mailbox,
    lock,
    staffId: "staff-one",
    secret: "fixture-encryption-secret",
    observe: async (message) => ({
      ...message,
      threadId: message.threadId ?? "thread",
      subject: message.subject ?? "",
      bodyText: "",
      sender: "",
      to: [],
      cc: [],
      bcc: [],
      removed: false,
    }),
  });
  const session = await uploads.start({
    id: "draft",
    changeKey: "one",
    editToken: "editor",
    name: "large.bin",
    contentType: "application/octet-stream",
    size: 3_000_000,
  });
  expect(session.ticket).not.toContain("private-fixture-capability");
  expect(session.ticket).not.toContain("outlook.office.com");
  await expect(
    uploads.start({
      id: "draft",
      changeKey: "one",
      editToken: "editor",
      name: "second.bin",
      contentType: "application/octet-stream",
      size: 3_000_000,
    }),
  ).rejects.toThrow(/being edited/);
  await expect(
    uploads.chunk(session.ticket + "tampered", 0, new ArrayBuffer(1)),
  ).rejects.toThrow();
  expect(writing).toBe(true);
  const otherStaff = attachmentUploads({
    mailbox,
    lock,
    staffId: "staff-two",
    secret: "fixture-encryption-secret",
    observe: async () => {
      throw new Error("must not observe");
    },
  });
  await expect(
    otherStaff.chunk(session.ticket, 0, new ArrayBuffer(1)),
  ).rejects.toThrow();
  // Wrong ranges are rejected before reaching the provider, and do not unlock the draft.
  await expect(
    uploads.chunk(session.ticket, 1, new ArrayBuffer(1)),
  ).rejects.toThrow(/range/);
  expect(requests.filter((url) => url.includes("authtoken"))).toHaveLength(0);
});

function uploadFixture() {
  let token = "editor";
  let writing = false;
  let changed = false;
  let completed = false;
  let oldSize = 0;
  let cancelFails = false;
  const ranges: string[] = [];
  const methods: string[] = [];
  const lock: DraftUploadLock = {
    start: async (_id, _version, editor, upload) => {
      if (writing || token !== editor) return false;
      token = upload;
      writing = true;
      return true;
    },
    move: async (_id, from, to, _expires, hold) => {
      if (token !== from || !writing) return false;
      token = to;
      writing = hold;
      return true;
    },
  };
  const mailbox = createGraphMailbox({
    mailbox: {
      environment: "development",
      address: "admin@development.altitutor.com",
      allowedRecipients: [],
    },
    accessToken: "fixture-token",
    fetchImpl: async (input, init) => {
      methods.push(init?.method ?? "GET");
      const url = String(input);
      if (url.includes("createUploadSession"))
        return Response.json(
          {
            uploadUrl: "https://outlook.office.com/upload?authtoken=fixture",
            expirationDateTime: new Date(Date.now() + 600_000).toISOString(),
          },
          { status: 201 },
        );
      if (init?.method === "PUT") {
        const range = new Headers(init.headers).get("Content-Range")!;
        ranges.push(range);
        if (range === "bytes 0-1966079/3000000")
          return Response.json({ nextExpectedRanges: ["1966080"] });
        completed = true;
        return new Response(null, {
          status: 201,
          headers: {
            Location: "https://outlook.office.com/Attachments('file')",
          },
        });
      }
      if (init?.method === "DELETE")
        return new Response(null, { status: cancelFails ? 503 : 204 });
      if (url.includes("/attachments"))
        return Response.json({
          value: oldSize
            ? [
                {
                  id: "old",
                  name: "old.bin",
                  size: oldSize,
                  "@odata.type": "#microsoft.graph.fileAttachment",
                },
              ]
            : [],
        });
      return Response.json({
        id: "draft",
        conversationId: "thread",
        isDraft: true,
        changeKey: changed ? "outlook" : completed ? "two" : "one",
        hasAttachments: completed,
        toRecipients: [],
        ccRecipients: [],
        bccRecipients: [],
      });
    },
  });
  const uploads = attachmentUploads({
    mailbox,
    lock,
    staffId: "staff",
    secret: "fixture-secret",
    observe: async (message) => ({
      ...message,
      threadId: "thread",
      subject: "",
      bodyText: "",
      sender: "",
      to: [],
      cc: [],
      bcc: [],
      removed: false,
    }),
  });
  return {
    uploads,
    start: () =>
      uploads.start({
        id: "draft",
        changeKey: "one",
        editToken: "editor",
        name: "large.bin",
        contentType: "application/octet-stream",
        size: 3_000_000,
      }),
    ranges,
    methods,
    isWriting: () => writing,
    changeInOutlook: () => {
      changed = true;
    },
    existingSize: (size: number) => {
      oldSize = size;
    },
    failCancel: () => {
      cancelFails = true;
    },
  };
}
it("confirms a complete two-chunk upload, returns the updated draft and rejects a replay", async () => {
  const fixture = uploadFixture();
  const { ticket } = await fixture.start();
  await expect(
    fixture.uploads.chunk(ticket, 0, new ArrayBuffer(1_966_080)),
  ).resolves.toEqual({ state: "uploading", nextOffset: 1_966_080 });
  expect(fixture.isWriting()).toBe(true);
  await expect(
    fixture.uploads.chunk(ticket, 1_966_080, new ArrayBuffer(1_033_920)),
  ).resolves.toMatchObject({
    state: "saved",
    attachment: { id: "file" },
    message: { changeKey: "two", hasAttachments: true },
  });
  expect(fixture.isWriting()).toBe(false);
  await expect(
    fixture.uploads.chunk(ticket, 1_966_080, new ArrayBuffer(1_033_920)),
  ).rejects.toThrow(/already running or completed/);
  expect(fixture.ranges).toEqual([
    "bytes 0-1966079/3000000",
    "bytes 1966080-2999999/3000000",
  ]);
});
it("enforces the aggregate 20 MB limit before creating a provider session and releases the editor", async () => {
  const fixture = uploadFixture();
  fixture.existingSize(18_000_000);
  await expect(fixture.start()).rejects.toThrow(/20 MB/);
  expect(fixture.methods).not.toContain("POST");
  expect(fixture.isWriting()).toBe(false);
});
it("rejects an Outlook edit before the final chunk and reconciles cancellation without attaching", async () => {
  const fixture = uploadFixture();
  const { ticket } = await fixture.start();
  await fixture.uploads.chunk(ticket, 0, new ArrayBuffer(1_966_080));
  fixture.changeInOutlook();
  await expect(
    fixture.uploads.chunk(ticket, 1_966_080, new ArrayBuffer(1_033_920)),
  ).rejects.toThrow(/draft changed/);
  expect(fixture.ranges).toHaveLength(1);
  expect(fixture.isWriting()).toBe(true);
  await expect(fixture.uploads.cancel(ticket)).resolves.toMatchObject({
    state: "cancelled",
    message: { changeKey: "outlook" },
  });
  expect(fixture.isWriting()).toBe(false);
});
it("keeps the send-excluding lease when provider cancellation is unconfirmed", async () => {
  const fixture = uploadFixture();
  const { ticket } = await fixture.start();
  fixture.failCancel();
  await expect(fixture.uploads.cancel(ticket)).rejects.toThrow();
  expect(fixture.isWriting()).toBe(true);
  await expect(fixture.start()).rejects.toThrow(/being edited/);
});
