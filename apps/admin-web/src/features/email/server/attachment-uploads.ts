import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import type { EmailMessage } from "../types";
import type { createGraphMailbox, GraphMailMessage } from "./graph";
import {
  EMAIL_ATTACHMENT_CHUNK_BYTES,
  MAX_EMAIL_ATTACHMENT_BYTES,
  uploadFileSchema,
} from "../attachment-policy";

type Mailbox = ReturnType<typeof createGraphMailbox>;
export class AttachmentUploadError extends Error {
  constructor(
    message: string,
    public readonly status = 409,
  ) {
    super(message);
  }
}
/** The existing durable draft write lease also excludes sends and other editors.
 * Each request swaps its random operation token atomically; abandoned operations
 * expire within ten minutes. The encrypted ticket never grants a mailbox token. */
export interface DraftUploadLock {
  start: (
    id: string,
    version: string,
    editor: string,
    upload: string,
    expires: string,
  ) => Promise<boolean>;
  move: (
    id: string,
    from: string,
    to: string,
    expires: string,
    hold: boolean,
  ) => Promise<boolean>;
}
export function draftUploadLock(
  db: SupabaseClient<Database>,
  staffId: string,
): DraftUploadLock {
  return {
    async start(id, version, editor, upload, expires) {
      const claim = await db
        .rpc("email_claim_draft", {
          p_message_id: id,
          p_change_key: version,
          p_staff_id: staffId,
          p_token: editor,
        })
        .abortSignal(AbortSignal.timeout(5_000));
      if (claim.error)
        throw new AttachmentUploadError("Could not lock this draft.", 503);
      if (
        !claim.data ||
        typeof claim.data !== "object" ||
        Array.isArray(claim.data) ||
        claim.data.state !== "ready"
      )
        return false;
      const moved = await db
        .from("email_draft_edits")
        .update({ token: upload, expires_at: expires, writing_until: expires })
        .eq("message_id", id)
        .eq("staff_id", staffId)
        .eq("token", editor)
        .gt("writing_until", new Date().toISOString())
        .select("message_id")
        .abortSignal(AbortSignal.timeout(5_000))
        .maybeSingle();
      if (moved.error)
        throw new AttachmentUploadError("Could not lock this draft.", 503);
      return Boolean(moved.data);
    },
    async move(id, from, to, expires, hold) {
      const moved = await db
        .from("email_draft_edits")
        .update({
          token: to,
          expires_at: expires,
          writing_until: hold ? expires : null,
        })
        .eq("message_id", id)
        .eq("staff_id", staffId)
        .eq("token", from)
        .gt("expires_at", new Date().toISOString())
        .gt("writing_until", new Date().toISOString())
        .select("message_id")
        .abortSignal(AbortSignal.timeout(5_000))
        .maybeSingle();
      if (moved.error)
        throw new AttachmentUploadError(
          "Could not update this upload's draft lock.",
          503,
        );
      return Boolean(moved.data);
    },
  };
}
const ticketSchema = z.object({
  id: z.string(),
  staffId: z.string(),
  editor: z.string(),
  upload: z.string(),
  url: z.string().url(),
  expires: z.number(),
  size: z.number().int().positive(),
  version: z.string(),
});
type Ticket = z.infer<typeof ticketSchema>;
export function attachmentUploads({
  mailbox,
  lock,
  staffId,
  secret,
  observe,
}: {
  mailbox: Mailbox;
  lock: DraftUploadLock;
  staffId: string;
  secret: string;
  observe: (message: GraphMailMessage) => Promise<EmailMessage>;
}) {
  if (!secret)
    throw new AttachmentUploadError("Mailbox uploads are not configured.", 503);
  const key = createHash("sha256")
    .update("email-attachment-upload-v1\0")
    .update(secret)
    .digest();
  const aad = Buffer.from(mailbox.policy.address);
  function seal(value: Ticket) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(aad);
    return [
      iv,
      Buffer.concat([
        cipher.update(JSON.stringify(value), "utf8"),
        cipher.final(),
      ]),
      cipher.getAuthTag(),
    ]
      .map((part) => part.toString("base64url"))
      .join(".");
  }
  function open(value: string, allowExpired = false): Ticket {
    try {
      if (value.length > 32_000) throw new Error();
      const parts = value.split(".");
      if (parts.length !== 3) throw new Error();
      const [iv, content, tag] = parts.map((part) =>
        Buffer.from(part, "base64url"),
      );
      if (iv.length !== 12 || tag.length !== 16) throw new Error();
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAAD(aad);
      decipher.setAuthTag(tag);
      const ticket = ticketSchema.parse(
        JSON.parse(
          Buffer.concat([decipher.update(content), decipher.final()]).toString(
            "utf8",
          ),
        ),
      );
      if (
        ticket.staffId !== staffId ||
        (!allowExpired && ticket.expires <= Date.now())
      )
        throw new Error();
      return ticket;
    } catch {
      throw new AttachmentUploadError(
        "This upload expired or is invalid. Check the draft before attaching again.",
      );
    }
  }
  async function unlock(ticket: Ticket, owner: string, hold: boolean) {
    const changed = await lock.move(
      ticket.id,
      owner,
      hold ? ticket.upload : ticket.editor,
      new Date(hold ? ticket.expires : Date.now() + 60_000).toISOString(),
      hold,
    );
    if (!changed)
      throw new AttachmentUploadError(
        "This upload's draft lock changed. Refresh the draft before continuing.",
      );
  }
  return {
    async start(input: z.infer<typeof uploadFileSchema>) {
      const upload = randomUUID();
      const expires = Date.now() + 10 * 60_000;
      if (
        !(await lock.start(
          input.id,
          input.changeKey,
          input.editToken,
          upload,
          new Date(expires).toISOString(),
        ))
      )
        throw new AttachmentUploadError(
          "This draft changed, is scheduled or is being edited. Refresh before attaching.",
        );
      let session:
        | Awaited<ReturnType<Mailbox["createAttachmentUpload"]>>
        | undefined;
      const ticket: Ticket = {
        id: input.id,
        staffId,
        editor: input.editToken,
        upload,
        url: "https://outlook.office.com",
        expires,
        size: input.size,
        version: input.changeKey,
      };
      try {
        const draft = await mailbox.message(input.id);
        if (!draft.draft || draft.changeKey !== input.changeKey)
          throw new AttachmentUploadError(
            "Microsoft's draft changed. Review it before attaching.",
          );
        const existing = await mailbox.attachments(input.id);
        if (
          existing.reduce((sum, file) => sum + file.size, input.size) >
          MAX_EMAIL_ATTACHMENT_BYTES
        )
          throw new AttachmentUploadError(
            "Keep all attachments together within 20 MB.",
            400,
          );
        session = await mailbox.createAttachmentUpload(input.id, {
          name: input.name,
          size: input.size,
          contentType: input.contentType,
        });
        ticket.url = session.uploadUrl;
        ticket.expires = Math.min(
          expires,
          new Date(session.expirationDateTime).getTime(),
        );
        if (ticket.expires <= Date.now())
          throw new AttachmentUploadError(
            "Microsoft's upload session expired. Try again.",
          );
        await unlock(ticket, upload, true);
        return {
          ticket: seal(ticket),
          chunkSize: EMAIL_ATTACHMENT_CHUNK_BYTES,
        };
      } catch (error) {
        if (session)
          await mailbox
            .cancelAttachmentUpload(session.uploadUrl)
            .catch(() => {});
        await unlock(ticket, upload, false);
        throw error;
      }
    },
    async chunk(value: string, offset: number, bytes: ArrayBuffer) {
      const ticket = open(value);
      if (
        !Number.isSafeInteger(offset) ||
        offset < 0 ||
        offset % EMAIL_ATTACHMENT_CHUNK_BYTES !== 0 ||
        bytes.byteLength !==
          Math.min(EMAIL_ATTACHMENT_CHUNK_BYTES, ticket.size - offset) ||
        !bytes.byteLength
      )
        throw new AttachmentUploadError("Invalid attachment byte range.", 400);
      const request = randomUUID();
      if (
        !(await lock.move(
          ticket.id,
          ticket.upload,
          request,
          new Date(
            Math.max(ticket.expires, Date.now() + 120_000),
          ).toISOString(),
          true,
        ))
      )
        throw new AttachmentUploadError(
          "An upload is already running or completed. Check the draft before retrying.",
        );
      let complete = false;
      try {
        if (offset + bytes.byteLength === ticket.size) {
          const current = await mailbox.message(ticket.id);
          if (!current.draft || current.changeKey !== ticket.version)
            throw new AttachmentUploadError(
              "Microsoft's draft changed while uploading. Review it before attaching again.",
            );
        }
        const result = await mailbox.uploadAttachmentChunk(
          ticket.url,
          bytes,
          offset,
          ticket.size,
        );
        complete = result.complete;
        if (!result.complete)
          return { state: "uploading", nextOffset: result.nextOffset };
        if (offset + bytes.byteLength !== ticket.size)
          throw new AttachmentUploadError(
            "Attachment outcome could not be confirmed. Check the draft before retrying.",
          );
        const message = await observe(await mailbox.message(ticket.id));
        return {
          state: "saved",
          attachment: { id: result.attachmentId },
          message,
        };
      } finally {
        await unlock(ticket, request, !complete);
      }
    },
    async cancel(value: string) {
      const ticket = open(value, true);
      const request = randomUUID();
      if (
        !(await lock.move(
          ticket.id,
          ticket.upload,
          request,
          new Date(
            Math.max(ticket.expires, Date.now() + 120_000),
          ).toISOString(),
          true,
        ))
      )
        throw new AttachmentUploadError(
          "The upload may still be finishing. Refresh the draft before retrying.",
        );
      let cancelled = false;
      try {
        await mailbox.cancelAttachmentUpload(ticket.url);
        const message = await observe(await mailbox.message(ticket.id));
        cancelled = true;
        return { state: "cancelled", message };
      } finally {
        await unlock(ticket, request, !cancelled);
      }
    },
  };
}
