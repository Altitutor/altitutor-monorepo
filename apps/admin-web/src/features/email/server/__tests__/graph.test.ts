/** @jest-environment node */
import { createGraphMailbox } from "../graph";

describe("shared mailbox commands", () => {
  it("moves and marks the same immutable message read in the Microsoft mailbox", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      requests.push({ url, init });
      if (url.endsWith("/messages/stable-id/move")) {
        return Response.json({
          id: "stable-id",
          conversationId: "conversation-1",
          parentFolderId: "archive",
          isRead: false,
          isDraft: false,
          subject: "Class change",
        });
      }
      return new Response(null, { status: 204 });
    };
    const mailbox = createGraphMailbox({
      mailbox: {
        environment: "production",
        address: "admin@altitutor.com",
        allowedRecipients: [],
      },
      accessToken: "fixture-token",
      fetchImpl,
    });

    const moved = await mailbox.move("stable-id", "archive");
    await mailbox.setRead(moved.id, true);

    expect(moved).toMatchObject({
      id: "stable-id",
      threadId: "conversation-1",
      folderId: "archive",
    });
    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      "/v1.0/users/admin%40altitutor.com/messages/stable-id/move",
      "/v1.0/users/admin%40altitutor.com/messages/stable-id",
    ]);
    expect(JSON.parse(String(requests[0].init?.body))).toEqual({
      destinationId: "archive",
    });
    expect(JSON.parse(String(requests[1].init?.body))).toEqual({
      isRead: true,
    });
    expect(new Headers(requests[0].init?.headers).get("Prefer")).toContain(
      'IdType="ImmutableId"',
    );
  });

  it("reads Outlook folder changes including read state, drafts and removals without following foreign cursors", async () => {
    const fetchImpl = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValue(
        Response.json({
          value: [
            {
              id: "one",
              conversationId: "thread",
              parentFolderId: "inbox",
              subject: "A reply",
              isRead: true,
              isDraft: false,
              from: {
                emailAddress: {
                  address: "parent@example.test",
                  name: "Parent",
                },
              },
              toRecipients: [
                { emailAddress: { address: "admin@altitutor.com" } },
              ],
              body: { content: "Hello", contentType: "text" },
              receivedDateTime: "2026-10-29T04:00:00Z",
            },
            {
              id: "draft",
              conversationId: "thread",
              parentFolderId: "drafts",
              isDraft: true,
              isRead: true,
            },
            { id: "moved", "@removed": { reason: "deleted" } },
          ],
          "@odata.deltaLink":
            "https://graph.microsoft.com/v1.0/users/admin%40altitutor.com/mailFolders/inbox/messages/delta?$deltatoken=fixture",
        }),
      );
    const mailbox = createGraphMailbox({
      mailbox: {
        environment: "production",
        address: "admin@altitutor.com",
        allowedRecipients: [],
      },
      accessToken: "fixture-token",
      fetchImpl,
    });

    const page = await mailbox.changes("inbox");

    expect(page.messages).toMatchObject([
      {
        id: "one",
        read: true,
        draft: false,
        sender: "parent@example.test",
        bodyText: "Hello",
      },
      { id: "draft", draft: true },
    ]);
    expect(page.removedIds).toEqual(["moved"]);
    expect(page.complete).toBe(true);
    await expect(
      mailbox.changes("inbox", "https://example.test/collect-token"),
    ).rejects.toThrow("continuation");
    await expect(
      mailbox.changes(
        "inbox",
        "https://graph.microsoft.com/v1.0/users/another-mailbox/mailFolders/inbox/messages/delta",
      ),
    ).rejects.toThrow("continuation");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("loads recent history first and accepts equivalent Microsoft OData cursors only for the same mailbox and folder", async () => {
    const cursor =
      "https://graph.microsoft.com/v1.0/users('admin%40altitutor.com')/mailfolders('inbox')/messages/delta?$skiptoken=opaque";
    const fetchImpl = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValueOnce(
        Response.json({ value: [], "@odata.nextLink": cursor }),
      )
      .mockResolvedValueOnce(
        Response.json({
          value: [],
          "@odata.deltaLink": cursor.replace("skiptoken", "deltatoken"),
        }),
      );
    const mailbox = createGraphMailbox({
      mailbox: {
        environment: "production",
        address: "admin@altitutor.com",
        allowedRecipients: [],
      },
      accessToken: "fixture-token",
      fetchImpl,
    });
    const first = await mailbox.changes("inbox");
    expect(
      new URL(String(fetchImpl.mock.calls[0][0])).searchParams.get("$orderby"),
    ).toBe("receivedDateTime desc");
    expect(first.complete).toBe(false);
    expect((await mailbox.changes("inbox", first.cursor)).complete).toBe(true);
    await expect(
      mailbox.changes("inbox", cursor.replace("'inbox'", "'other-folder'")),
    ).rejects.toThrow("continuation");
    await expect(
      mailbox.changes(
        "inbox",
        cursor.replace("admin%40altitutor.com", "other%40altitutor.com"),
      ),
    ).rejects.toThrow("continuation");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("discovers Outlook-created nested folders rather than inventing local folder names", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/mailFolders"))
        return Response.json({
          value: [
            {
              id: "root",
              displayName: "Family correspondence",
              childFolderCount: 1,
              parentFolderId: "mail-root",
            },
          ],
        });
      if (url.pathname.endsWith("/mailFolders/root/childFolders"))
        return Response.json({
          value: [
            {
              id: "child",
              displayName: "Chemistry",
              childFolderCount: 0,
              parentFolderId: "root",
            },
          ],
        });
      throw new Error("Unexpected provider request");
    };
    const mailbox = createGraphMailbox({
      mailbox: {
        environment: "production",
        address: "admin@altitutor.com",
        allowedRecipients: [],
      },
      accessToken: "fixture-token",
      fetchImpl,
    });

    expect(await mailbox.folders()).toEqual([
      { id: "root", name: "Family correspondence", parentId: "mail-root" },
      { id: "child", name: "Chemistry", parentId: "root" },
    ]);
  });

  it("treats send acceptance as submitted and a lost response as uncertain without retrying", async () => {
    const acceptedFetch = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValue(new Response(null, { status: 202 }));
    const accepted = createGraphMailbox({
      mailbox: {
        environment: "production",
        address: "admin@altitutor.com",
        allowedRecipients: [],
      },
      accessToken: "fixture-token",
      fetchImpl: acceptedFetch,
    });
    expect(
      await accepted.sendDraft("draft-one", { to: ["parent@example.test"] }),
    ).toEqual({
      state: "submitted",
    });

    const lostFetch = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockRejectedValue(new Error("Connection lost after request body"));
    const lost = createGraphMailbox({
      mailbox: {
        environment: "production",
        address: "admin@altitutor.com",
        allowedRecipients: [],
      },
      accessToken: "fixture-token",
      fetchImpl: lostFetch,
    });
    expect(
      await lost.sendDraft("draft-two", { to: ["parent@example.test"] }),
    ).toEqual({ state: "uncertain" });
    expect(lostFetch).toHaveBeenCalledTimes(1);
    expect(acceptedFetch).toHaveBeenCalledTimes(1);
  });

  it("distinguishes a definite send rejection from an uncertain response without retrying", async () => {
    const fetchImpl = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValue(new Response(null, { status: 403 }));
    expect(
      await createGraphMailbox({
        mailbox: {
          environment: "production",
          address: "admin@altitutor.com",
          allowedRecipients: [],
        },
        accessToken: "fixture-token",
        fetchImpl,
      }).sendDraft("rejected-draft", { to: ["parent@example.test"] }),
    ).toEqual({ state: "failed" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("creates a shared draft and genuine reply drafts with provider-selected recipients", async () => {
    const fetchImpl = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValueOnce(
        Response.json({
          id: "new-draft",
          parentFolderId: "drafts",
          isDraft: true,
          from: null,
          subject: null,
          changeKey: "one",
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          id: "reply-draft",
          parentFolderId: "drafts",
          isDraft: true,
          conversationId: "existing",
          toRecipients: [
            { emailAddress: { address: "reply-destination@example.test" } },
          ],
          changeKey: "two",
        }),
      );
    const mailbox = createGraphMailbox({
      mailbox: {
        environment: "production",
        address: "admin@altitutor.com",
        allowedRecipients: [],
      },
      accessToken: "fixture-token",
      fetchImpl,
    });
    expect(await mailbox.createDraft()).toMatchObject({
      id: "new-draft",
      draft: true,
    });
    expect(
      await mailbox.createDraft({ messageId: "original", mode: "replyAll" }),
    ).toMatchObject({
      id: "reply-draft",
      threadId: "existing",
      to: ["reply-destination@example.test"],
    });
    expect(String(fetchImpl.mock.calls[1][0])).toContain(
      "/messages/original/createReplyAll",
    );
    expect(fetchImpl.mock.calls[1][1]?.body).toBeUndefined();
  });

  it("reads downloadable attachment bytes from the selected mailbox message", async () => {
    const fetchImpl = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValueOnce(
        Response.json({
          value: [
            {
              id: "attachment",
              name: "worksheet.pdf",
              size: 3,
              contentType: "application/pdf",
              "@odata.type": "#microsoft.graph.fileAttachment",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), {
          headers: { "content-type": "application/pdf" },
        }),
      );
    const mailbox = createGraphMailbox({
      mailbox: {
        environment: "production",
        address: "admin@altitutor.com",
        allowedRecipients: [],
      },
      accessToken: "fixture-token",
      fetchImpl,
    });
    expect(await mailbox.attachments("original")).toEqual([
      {
        id: "attachment",
        name: "worksheet.pdf",
        size: 3,
        contentType: "application/pdf",
        type: "#microsoft.graph.fileAttachment",
      },
    ]);
    const file = await mailbox.attachment("original", "attachment");
    expect(Array.from(new Uint8Array(await file.arrayBuffer()))).toEqual([
      1, 2, 3,
    ]);
    expect(String(fetchImpl.mock.calls[1][0])).toContain(
      "/messages/original/attachments/attachment/$value",
    );
  });

  it("creates a forward draft with its destination and uploads a small file before submission", async () => {
    const fetchImpl = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValueOnce(
        Response.json({
          id: "forward-draft",
          isDraft: true,
          parentFolderId: "drafts",
          changeKey: "one",
        }),
      )
      .mockResolvedValueOnce(Response.json({ id: "attached-file" }))
      .mockResolvedValueOnce(
        Response.json({
          id: "forward-draft",
          isDraft: true,
          parentFolderId: "drafts",
          changeKey: "two",
          hasAttachments: true,
        }),
      );
    const mailbox = createGraphMailbox({
      mailbox: {
        environment: "production",
        address: "admin@altitutor.com",
        allowedRecipients: [],
      },
      accessToken: "fixture-token",
      fetchImpl,
    });
    expect(
      await mailbox.forwardDraft("original", ["tutor@example.test"]),
    ).toMatchObject({ id: "forward-draft", draft: true });
    await mailbox.addAttachment("forward-draft", {
      name: "work.txt",
      contentType: "text/plain",
      contentBytes: "SGk=",
    });
    expect(await mailbox.message("forward-draft")).toMatchObject({
      changeKey: "two",
      hasAttachments: true,
    });
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toEqual({
      toRecipients: [{ emailAddress: { address: "tutor@example.test" } }],
    });
    expect(JSON.parse(String(fetchImpl.mock.calls[1][1]?.body))).toMatchObject({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: "work.txt",
      contentBytes: "SGk=",
    });
  });

  it("resolves well-known Microsoft folders without depending on English display names", async () => {
    const fetchImpl = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValue(
        Response.json({
          id: "localized-inbox",
          displayName: "Posteingang",
          parentFolderId: "root",
        }),
      );
    const mailbox = createGraphMailbox({
      mailbox: {
        environment: "production",
        address: "admin@altitutor.com",
        allowedRecipients: [],
      },
      accessToken: "fixture-token",
      fetchImpl,
    });
    expect(await mailbox.folder("inbox")).toEqual({
      id: "localized-inbox",
      name: "Posteingang",
      parentId: "root",
    });
  });

  it("recovers an operational message by its durable marker after a lost draft-creation response", async () => {
    const fetchImpl = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValue(
        Response.json({
          value: [
            {
              id: "recovered-operation",
              conversationId: "op-thread",
              parentFolderId: "drafts",
              isDraft: true,
              changeKey: "one",
            },
          ],
        }),
      );
    const mailbox = createGraphMailbox({
      mailbox: {
        environment: "production",
        address: "admin@altitutor.com",
        allowedRecipients: [],
      },
      accessToken: "fixture-token",
      fetchImpl,
    });
    expect(await mailbox.findOperation("operation-fixture")).toMatchObject({
      id: "recovered-operation",
      draft: true,
      threadId: "op-thread",
    });
    const query = new URL(String(fetchImpl.mock.calls[0][0]));
    expect(query.pathname).toBe("/v1.0/users/admin%40altitutor.com/messages");
    expect(query.searchParams.get("$filter")).toContain(
      "ep/value eq 'operation-fixture'",
    );
  });

  it("preserves work when Outlook has changed a shared draft", async () => {
    const fetchImpl = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockImplementation(async (_input, init) =>
        Response.json({
          id: "shared-draft",
          parentFolderId: "drafts",
          conversationId: "thread",
          isDraft: true,
          changeKey:
            init?.method === "PATCH" ? "saved-version" : "outlook-version",
          body: {
            content:
              init?.method === "PATCH"
                ? "My recovered work"
                : "Outlook colleague's text",
          },
        }),
      );
    const mailbox = createGraphMailbox({
      mailbox: {
        environment: "production",
        address: "admin@altitutor.com",
        allowedRecipients: [],
      },
      accessToken: "fixture-token",
      fetchImpl,
    });

    const result = await mailbox.saveDraft("shared-draft", {
      expectedChangeKey: "portal-version",
      bodyText: "My unsaved work",
      to: ["parent@example.test"],
      subject: "Follow-up",
    });

    expect(result).toMatchObject({
      state: "conflict",
      message: {
        changeKey: "outlook-version",
        bodyText: "Outlook colleague's text",
      },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][1]?.method).toBe("GET");
    const recovered = await mailbox.saveDraft("shared-draft", {
      expectedChangeKey: "outlook-version",
      bodyText: "My recovered work",
      to: ["parent@example.test"],
      subject: "Follow-up",
    });
    expect(recovered).toMatchObject({
      state: "saved",
      message: { bodyText: "My recovered work" },
    });
    expect(JSON.parse(String(fetchImpl.mock.calls[2][1]?.body))).toMatchObject({
      body: { contentType: "Text", content: "My recovered work" },
      toRecipients: [{ emailAddress: { address: "parent@example.test" } }],
    });
  });
});
it("uses the development mailbox and rejects production mailbox continuation links", async () => {
  const requests: string[] = [];
  const mailbox = createGraphMailbox({
    mailbox: {
      environment: "development",
      address: "admin@development.altitutor.com",
      allowedRecipients: ["matt@altitutor.com"],
    },
    accessToken: "fixture-token",
    fetchImpl: async (input) => {
      requests.push(String(input));
      return Response.json({
        value: [],
        "@odata.deltaLink":
          "https://graph.microsoft.com/v1.0/users/admin%40altitutor.com/mailFolders/inbox/messages/delta?$deltatoken=foreign",
      });
    },
  });
  await expect(mailbox.changes("inbox")).rejects.toThrow(
    "Unexpected Microsoft Graph continuation",
  );
  expect(requests[0]).toContain("users/admin%40development.altitutor.com/");
});
