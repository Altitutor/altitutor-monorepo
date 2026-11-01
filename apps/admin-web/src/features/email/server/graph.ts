import { z } from "zod";
import {
  OPERATIONAL_MAIL_PROPERTY,
  assertMailboxPolicy,
  assertMailboxRecipients,
  type MailboxPolicy,
} from "@altitutor/email";

export class GraphMailboxError extends Error {
  constructor(public readonly status: number) {
    super(`Microsoft Graph request failed (${status}).`);
    this.name = "GraphMailboxError";
  }
}
const graphMessage = z.object({
  id: z.string(),
  conversationId: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
  parentFolderId: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
  subject: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
  isRead: z.boolean().optional(),
  isDraft: z.boolean().optional(),
  body: z
    .object({
      content: z.string(),
      contentType: z
        .string()
        .nullish()
        .transform((value) => value ?? undefined),
    })
    .optional(),
  from: z
    .object({
      emailAddress: z.object({
        address: z.string(),
        name: z
          .string()
          .nullish()
          .transform((value) => value ?? undefined),
      }),
    })
    .nullish()
    .transform((value) => value ?? undefined),
  toRecipients: z
    .array(z.object({ emailAddress: z.object({ address: z.string() }) }))
    .optional(),
  ccRecipients: z
    .array(z.object({ emailAddress: z.object({ address: z.string() }) }))
    .optional(),
  bccRecipients: z
    .array(z.object({ emailAddress: z.object({ address: z.string() }) }))
    .optional(),
  receivedDateTime: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
  sentDateTime: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
  internetMessageId: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
  changeKey: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
  hasAttachments: z.boolean().optional(),
  internetMessageHeaders: z
    .array(z.object({ name: z.string(), value: z.string() }))
    .optional(),
});
const removedMessage = z.object({
  id: z.string(),
  "@removed": z.object({}).passthrough(),
});
const deltaPage = z.object({
  value: z.array(z.union([removedMessage, graphMessage])),
  "@odata.nextLink": z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
  "@odata.deltaLink": z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
});
const folderPage = z.object({
  value: z.array(
    z.object({
      id: z.string(),
      displayName: z.string(),
      parentFolderId: z
        .string()
        .nullish()
        .transform((value) => value ?? undefined),
      childFolderCount: z.number().int().nonnegative(),
    }),
  ),
  "@odata.nextLink": z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
});
function normalize(message: z.infer<typeof graphMessage>, folderId: string) {
  return {
    id: message.id,
    threadId: message.conversationId,
    replyToInternetMessageIds: message.internetMessageHeaders
      ?.filter((header) => header.name.toLowerCase() === "in-reply-to")
      .flatMap((header) => header.value.match(/<[^>]+>/g) ?? []),
    folderId: message.parentFolderId ?? folderId,
    read: message.isRead,
    draft: message.isDraft,
    subject: message.subject,
    bodyText:
      message.body?.contentType?.toLowerCase() === "html"
        ? message.body.content
            .replace(/<br\s*\/?\s*>|<\/(?:p|div|li|tr|h[1-6])>/gi, "\n")
            .replace(/<[^>]*>/g, "")
            .replace(/&nbsp;/gi, " ")
            .replace(/&lt;/gi, "<")
            .replace(/&gt;/gi, ">")
            .replace(/&amp;/gi, "&")
            .trim()
        : message.body?.content,
    bodyHtml: message.body
      ? message.body.contentType?.toLowerCase() === "html"
        ? message.body.content
        : null
      : undefined,
    sender: message.from?.emailAddress.address.toLowerCase(),
    senderName: message.from?.emailAddress.name,
    to: message.toRecipients?.map((item) =>
      item.emailAddress.address.toLowerCase(),
    ),
    cc: message.ccRecipients?.map((item) =>
      item.emailAddress.address.toLowerCase(),
    ),
    bcc: message.bccRecipients?.map((item) =>
      item.emailAddress.address.toLowerCase(),
    ),
    receivedAt: message.receivedDateTime,
    sentAt: message.sentDateTime,
    internetMessageId: message.internetMessageId,
    changeKey: message.changeKey,
    hasAttachments: message.hasAttachments,
  };
}
export type GraphMailMessage = ReturnType<typeof normalize>;

/** Microsoft transport only. Altitutor responsibility and business links live outside Graph. */
export function createGraphMailbox({
  mailbox,
  accessToken,
  fetchImpl = fetch,
}: {
  mailbox: MailboxPolicy;
  accessToken: string;
  fetchImpl?: typeof fetch;
}) {
  assertMailboxPolicy(mailbox);
  const base = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox.address)}`;
  function continuation(value: string, path: string) {
    const url = new URL(value);
    const segments = (pathname: string) =>
      pathname
        .split("/")
        .filter(Boolean)
        .flatMap((segment) => {
          const keyed = /^([a-z]+)\('((?:[^']|'')*)'\)$/i.exec(segment);
          return keyed
            ? [
                keyed[1].toLowerCase(),
                decodeURIComponent(keyed[2].replaceAll("''", "'")),
              ]
            : [decodeURIComponent(segment)];
        });
    const actual = segments(url.pathname);
    const expected = segments(new URL(`${base}${path}`).pathname);
    const matches =
      actual.length === expected.length &&
      actual.every((part, index) =>
        index === 4
          ? part === expected[index]
          : part.toLowerCase() === expected[index].toLowerCase(),
      );
    if (
      url.origin !== "https://graph.microsoft.com" ||
      url.username ||
      url.password ||
      url.hash ||
      !matches
    ) {
      throw new Error("Unexpected Microsoft Graph continuation URL.");
    }
    return value;
  }
  async function request(
    path: string,
    method = "GET",
    body?: unknown,
    signal?: AbortSignal,
  ) {
    const response = await fetchImpl(
      path.startsWith("https:") ? path : `${base}${path}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Prefer:
            'IdType="ImmutableId", outlook.body-content-type="html", odata.maxpagesize=100',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: signal ?? AbortSignal.timeout(15_000),
        cache: "no-store",
      },
    );
    if (!response.ok) throw new GraphMailboxError(response.status);
    return response;
  }
  function uploadUrl(value: string) {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !["outlook.office.com", "outlook.office365.com"].includes(url.hostname) ||
      url.port ||
      url.username ||
      url.password ||
      url.hash
    )
      throw new Error("Unexpected Microsoft attachment upload URL.");
    return value;
  }
  return {
    policy: mailbox,
    async folder(id: string) {
      const data = z
        .object({
          id: z.string(),
          displayName: z.string(),
          parentFolderId: z.string().optional(),
        })
        .parse(
          await (
            await request(`/mailFolders/${encodeURIComponent(id)}`)
          ).json(),
        );
      return {
        id: data.id,
        name: data.displayName,
        parentId: data.parentFolderId ?? null,
      };
    },
    async folders() {
      const folders: Array<{
        id: string;
        name: string;
        parentId: string | null;
      }> = [];
      const queue = [
        {
          url: "/mailFolders?includeHiddenFolders=false&$top=100",
          path: "/mailFolders",
        },
      ];
      const seen = new Set<string>();
      const known = new Set<string>();
      while (queue.length) {
        const entry = queue.shift()!;
        if (seen.has(entry.url))
          throw new Error("Microsoft Graph repeated a folder continuation.");
        seen.add(entry.url);
        const page = folderPage.parse(await (await request(entry.url)).json());
        for (const folder of page.value) {
          if (known.has(folder.id)) continue;
          known.add(folder.id);
          folders.push({
            id: folder.id,
            name: folder.displayName,
            parentId: folder.parentFolderId ?? null,
          });
          if (folder.childFolderCount) {
            const path = `/mailFolders/${encodeURIComponent(folder.id)}/childFolders`;
            queue.push({
              path,
              url: `${path}?includeHiddenFolders=false&$top=100`,
            });
          }
        }
        const next = page["@odata.nextLink"];
        if (next) {
          queue.push({ url: continuation(next, entry.path), path: entry.path });
        }
      }
      return folders;
    },
    async changes(folderId: string, cursor?: string) {
      const path = `/mailFolders/${encodeURIComponent(folderId)}/messages/delta`;
      const select =
        "id,conversationId,parentFolderId,subject,isRead,isDraft,body,from,toRecipients,ccRecipients,bccRecipients,receivedDateTime,sentDateTime,internetMessageId,changeKey,hasAttachments";
      const response = await request(
        cursor
          ? continuation(cursor, path)
          : `${path}?$select=${select}&$orderby=receivedDateTime%20desc`,
      );
      const page = deltaPage.parse(await response.json());
      const next = page["@odata.nextLink"] ?? page["@odata.deltaLink"];
      if (!next) throw new Error("Microsoft Graph omitted its sync cursor.");
      continuation(next, path);
      return {
        messages: page.value.flatMap((item) =>
          "@removed" in item ? [] : [normalize(item, folderId)],
        ),
        removedIds: page.value.flatMap((item) =>
          "@removed" in item ? [item.id] : [],
        ),
        cursor: next,
        complete: !page["@odata.nextLink"],
      };
    },
    async findOperation(id: string) {
      const literal = (value: string) => value.replaceAll("'", "''");
      const params = new URLSearchParams({
        $filter: `singleValueExtendedProperties/Any(ep:ep/id eq '${literal(OPERATIONAL_MAIL_PROPERTY)}' and ep/value eq '${literal(id)}')`,
        $top: "2",
      });
      const page = z
        .object({
          value: z.array(graphMessage),
          "@odata.nextLink": z.string().optional(),
        })
        .parse(await (await request(`/messages?${params}`)).json());
      if (page.value.length > 1 || page["@odata.nextLink"])
        throw new Error(
          "Microsoft returned multiple messages for the same operational command. Review before sending.",
        );
      return page.value[0] ? normalize(page.value[0], "") : null;
    },
    async message(id: string, replyHeaders = false, signal?: AbortSignal) {
      return normalize(
        graphMessage.parse(
          await (
            await request(
              `/messages/${encodeURIComponent(id)}${replyHeaders ? "?$select=id,conversationId,parentFolderId,subject,isRead,isDraft,body,from,toRecipients,ccRecipients,bccRecipients,receivedDateTime,sentDateTime,internetMessageId,changeKey,hasAttachments,internetMessageHeaders" : ""}`,
              "GET",
              undefined,
              signal,
            )
          ).json(),
        ),
        "",
      );
    },
    async forwardDraft(id: string, to: string[]) {
      assertMailboxRecipients(mailbox, { to });
      const response = await request(
        `/messages/${encodeURIComponent(id)}/createForward`,
        "POST",
        { toRecipients: to.map((address) => ({ emailAddress: { address } })) },
      );
      return normalize(graphMessage.parse(await response.json()), "");
    },
    async addAttachment(
      id: string,
      file: { name: string; contentType: string; contentBytes: string },
    ) {
      // Larger files use Graph upload sessions; this JSON endpoint is <3 MB.
      if (Buffer.byteLength(file.contentBytes, "base64") >= 3_000_000)
        throw new Error(
          "This attachment requires a large-file upload session.",
        );
      const response = await request(
        `/messages/${encodeURIComponent(id)}/attachments`,
        "POST",
        {
          "@odata.type": "#microsoft.graph.fileAttachment",
          ...file,
        },
      );
      return z.object({ id: z.string() }).parse(await response.json());
    },
    async createAttachmentUpload(
      id: string,
      file: { name: string; size: number; contentType: string },
    ) {
      const response = await request(
        `/messages/${encodeURIComponent(id)}/attachments/createUploadSession`,
        "POST",
        {
          AttachmentItem: { attachmentType: "file", ...file },
        },
      );
      const session = z
        .object({
          uploadUrl: z.string().url(),
          expirationDateTime: z.string().datetime({ offset: true }),
        })
        .parse(await response.json());
      uploadUrl(session.uploadUrl);
      return session;
    },
    async uploadAttachmentChunk(
      url: string,
      bytes: ArrayBuffer,
      offset: number,
      total: number,
    ) {
      if (
        !bytes.byteLength ||
        bytes.byteLength > 1_966_080 ||
        offset < 0 ||
        offset + bytes.byteLength > total
      )
        throw new Error("Invalid attachment byte range.");
      const response = await fetchImpl(uploadUrl(url), {
        method: "PUT",
        redirect: "error",
        cache: "no-store",
        body: bytes,
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Length": String(bytes.byteLength),
          "Content-Range": `bytes ${offset}-${offset + bytes.byteLength - 1}/${total}`,
        },
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) throw new GraphMailboxError(response.status);
      if (response.status === 201) {
        const location = response.headers.get("Location");
        if (!location)
          throw new Error("Attachment completion was not confirmed.");
        const path = new URL(location).pathname;
        const attachment =
          /\/Attachments\('([^']+)'\)/i.exec(path)?.[1] ??
          /\/attachments\/([^/]+)$/i.exec(path)?.[1];
        if (!attachment)
          throw new Error("Attachment completion was not confirmed.");
        return {
          complete: true as const,
          attachmentId: decodeURIComponent(attachment),
        };
      }
      const status = z
        .union([
          z
            .object({ nextExpectedRanges: z.array(z.string()).min(1) })
            .transform((value) => value.nextExpectedRanges),
          z
            .object({ NextExpectedRanges: z.array(z.string()).min(1) })
            .transform((value) => value.NextExpectedRanges),
        ])
        .parse(await response.json());
      const next = Number(status[0].split("-")[0]);
      if (next !== offset + bytes.byteLength)
        throw new Error(
          "Microsoft requested a different attachment range. Review the draft before retrying.",
        );
      return { complete: false as const, nextOffset: next };
    },
    async cancelAttachmentUpload(url: string) {
      const response = await fetchImpl(uploadUrl(url), {
        method: "DELETE",
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok && response.status !== 404 && response.status !== 410)
        throw new GraphMailboxError(response.status);
    },
    async removeAttachment(id: string, attachmentId: string) {
      await request(
        `/messages/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`,
        "DELETE",
      );
    },
    async attachments(id: string) {
      const path = `/messages/${encodeURIComponent(id)}/attachments`;
      const schema = z.object({
        value: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            size: z.number(),
            contentType: z.string().nullish(),
            "@odata.type": z.string(),
          }),
        ),
        "@odata.nextLink": z.string().optional(),
      });
      const result: Array<{
        id: string;
        name: string;
        size: number;
        contentType: string;
        type: string;
      }> = [];
      let url = path + "?$select=id,name,size,contentType";
      const seen = new Set<string>();
      while (url) {
        if (seen.has(url))
          throw new Error(
            "Microsoft Graph repeated an attachment continuation.",
          );
        seen.add(url);
        const page = schema.parse(await (await request(url)).json());
        result.push(
          ...page.value.map((item) => ({
            id: item.id,
            name: item.name,
            size: item.size,
            contentType: item.contentType ?? "application/octet-stream",
            type: item["@odata.type"],
          })),
        );
        url = page["@odata.nextLink"]
          ? continuation(page["@odata.nextLink"], path)
          : "";
      }
      return result;
    },
    async attachment(id: string, attachmentId: string, signal?: AbortSignal) {
      return request(
        `/messages/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}/$value`,
        "GET",
        undefined,
        signal,
      );
    },
    async createDraft(reply?: {
      messageId: string;
      mode: "reply" | "replyAll";
    }) {
      const path = reply
        ? `/messages/${encodeURIComponent(reply.messageId)}/${reply.mode === "replyAll" ? "createReplyAll" : "createReply"}`
        : "/messages";
      const response = await request(
        path,
        "POST",
        reply
          ? undefined
          : {
              subject: "",
              body: { contentType: "Text", content: "" },
              toRecipients: [],
            },
      );
      return normalize(graphMessage.parse(await response.json()), "");
    },
    async move(id: string, folderId: string) {
      const response = await request(
        `/messages/${encodeURIComponent(id)}/move`,
        "POST",
        { destinationId: folderId },
      );
      const message = graphMessage.parse(await response.json());
      return normalize(message, folderId);
    },
    async setRead(id: string, read: boolean) {
      await request(`/messages/${encodeURIComponent(id)}`, "PATCH", {
        isRead: read,
      });
    },
    async saveDraft(
      id: string,
      input: {
        expectedChangeKey: string;
        bodyText: string;
        bodyHtml?: string;
        subject: string;
        to: string[];
        cc?: string[];
        bcc?: string[];
      },
    ) {
      if (input.to.length || input.cc?.length || input.bcc?.length)
        assertMailboxRecipients(mailbox, input);
      const path = `/messages/${encodeURIComponent(id)}`;
      const current = graphMessage.parse(await (await request(path)).json());
      if (!current.isDraft || current.changeKey !== input.expectedChangeKey) {
        return { state: "conflict" as const, message: normalize(current, "") };
      }
      // Detect existing provider edits. This is not an atomic cross-client guard:
      // Graph's v1.0 contract does not establish conditional PATCH/send semantics.
      const recipients = (addresses: string[]) =>
        addresses.map((address) => ({ emailAddress: { address } }));
      const response = await request(path, "PATCH", {
        subject: input.subject,
        body: {
          contentType: input.bodyHtml ? "HTML" : "Text",
          content: input.bodyHtml ?? input.bodyText,
        },
        toRecipients: recipients(input.to),
        ...(input.cc ? { ccRecipients: recipients(input.cc) } : {}),
        ...(input.bcc ? { bccRecipients: recipients(input.bcc) } : {}),
      });
      return {
        state: "saved" as const,
        message: normalize(
          graphMessage.parse(await response.json()),
          current.parentFolderId ?? "",
        ),
      };
    },
    async sendDraft(
      id: string,
      recipients: { to: string[]; cc?: string[]; bcc?: string[] },
    ): Promise<{ state: "submitted" | "uncertain" | "failed" }> {
      assertMailboxRecipients(mailbox, recipients);
      try {
        const response = await request(
          `/messages/${encodeURIComponent(id)}/send`,
          "POST",
        );
        // Acceptance is not delivery. Never repeat an ambiguous external send here.
        return { state: response.status === 202 ? "submitted" : "uncertain" };
      } catch (error) {
        if (
          error instanceof GraphMailboxError &&
          error.status >= 400 &&
          error.status < 500 &&
          error.status !== 408
        )
          return { state: "failed" };
        return { state: "uncertain" };
      }
    },
  };
}
