/** @jest-environment node */
import { createGraphMailbox } from "../graph";

it("uploads sequential binary ranges without a bearer and reads the final attachment ID from Location", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const uploadUrl =
    "https://outlook.office.com/api/v2.0/fixture/AttachmentSessions('one')?authtoken=fixture";
  const mailbox = createGraphMailbox({
    mailbox: {
      environment: "development",
      address: "admin@development.altitutor.com",
      allowedRecipients: [],
    },
    accessToken: "fixture-token",
    fetchImpl: async (input, init) => {
      requests.push({ url: String(input), init });
      if (String(input).includes("createUploadSession"))
        return Response.json(
          {
            uploadUrl,
            expirationDateTime: "2030-01-01T00:00:00Z",
            nextExpectedRanges: ["0-"],
          },
          { status: 201 },
        );
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      return new Response(null, {
        status: 201,
        headers: {
          Location:
            "https://outlook.office.com/api/v2.0/fixture/Attachments('attachment%2Bfinal')",
        },
      });
    },
  });
  const session = await mailbox.createAttachmentUpload("draft", {
    name: "large.pdf",
    size: 3_100_000,
    contentType: "application/pdf",
  });
  const result = await mailbox.uploadAttachmentChunk(
    session.uploadUrl,
    new Uint8Array([1, 2, 3]).buffer,
    3_099_997,
    3_100_000,
  );
  expect(result).toEqual({ complete: true, attachmentId: "attachment+final" });
  expect(JSON.parse(String(requests[0].init?.body))).toEqual({
    AttachmentItem: {
      attachmentType: "file",
      name: "large.pdf",
      size: 3_100_000,
      contentType: "application/pdf",
    },
  });
  expect(
    new Headers(requests[1].init?.headers).get("Authorization"),
  ).toBeNull();
  expect(new Headers(requests[1].init?.headers).get("Content-Range")).toBe(
    "bytes 3099997-3099999/3100000",
  );
  await mailbox.cancelAttachmentUpload(session.uploadUrl);
  expect(
    new Headers(requests[2].init?.headers).get("Authorization"),
  ).toBeNull();
  await expect(
    mailbox.uploadAttachmentChunk(
      "https://example.test/upload",
      new ArrayBuffer(1),
      0,
      1,
    ),
  ).rejects.toThrow();
});

it.each(["nextExpectedRanges", "NextExpectedRanges"])(
  "accepts Microsoft's %s continuation without replaying bytes",
  async (field) => {
    const mailbox = createGraphMailbox({
      mailbox: {
        environment: "development",
        address: "admin@development.altitutor.com",
        allowedRecipients: [],
      },
      accessToken: "fixture-token",
      fetchImpl: async () => Response.json({ [field]: ["1966080"] }),
    });
    await expect(
      mailbox.uploadAttachmentChunk(
        "https://outlook.office.com/upload?authtoken=fixture",
        new ArrayBuffer(1_966_080),
        0,
        3_000_000,
      ),
    ).resolves.toEqual({ complete: false, nextOffset: 1_966_080 });
  },
);
