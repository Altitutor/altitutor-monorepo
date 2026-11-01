import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { emailAccess } from "@/features/email/server/auth";
import { connectMailbox } from "@/features/email/server/connection";
import { observeMailboxMessage } from "@/features/email/server/observe";
import {
  attachmentUploads,
  AttachmentUploadError,
  draftUploadLock,
} from "@/features/email/server/attachment-uploads";
import {
  EMAIL_ATTACHMENT_CHUNK_BYTES,
  uploadFileSchema,
} from "@/features/email/attachment-policy";
// Provider IO shares 45 seconds, observation has 10, and lock cleanup has 5.
// The 90-second platform budget leaves headroom for auth, parsing and cleanup.
export const maxDuration = 90;

async function handle(request: NextRequest) {
  const providerDeadline = AbortSignal.timeout(45_000);
  const access = await emailAccess();
  if ("error" in access)
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  try {
    const mailbox = await connectMailbox(providerDeadline);
    const uploads = attachmentUploads({
      mailbox,
      lock: draftUploadLock(access.admin, access.staff.id),
      staffId: access.staff.id,
      secret: process.env.EMAIL_M365_CLIENT_SECRET ?? "",
      observe: (message) =>
        observeMailboxMessage(
          access.admin,
          message,
          access.mailbox.address,
          AbortSignal.timeout(10_000),
        ),
    });
    let result: unknown;
    if (request.method === "POST") {
      result = await uploads.start(
        uploadFileSchema.parse(await request.json()),
      );
    } else if (request.method === "DELETE") {
      const { ticket } = z
        .object({ ticket: z.string().max(32_000) })
        .parse(await request.json());
      result = await uploads.cancel(ticket);
    } else {
      const length = request.headers.get("content-length");
      if (length && Number(length) > EMAIL_ATTACHMENT_CHUNK_BYTES + 64_000)
        throw new AttachmentUploadError("Attachment chunk is too large.", 413);
      const form = await request.formData();
      const ticket = form.get("ticket"),
        chunk = form.get("file"),
        range = form.get("offset");
      const offset =
        typeof range === "string" && /^\d+$/.test(range) ? Number(range) : NaN;
      if (
        typeof ticket !== "string" ||
        ticket.length > 32_000 ||
        !(chunk instanceof File) ||
        chunk.size > EMAIL_ATTACHMENT_CHUNK_BYTES
      )
        throw new AttachmentUploadError("Invalid attachment chunk.", 400);
      result = await uploads.chunk(ticket, offset, await chunk.arrayBuffer());
    }
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    // Never put provider capability URLs, HTTP errors or ticket contents in logs/responses.
    return NextResponse.json(
      {
        error:
          error instanceof AttachmentUploadError
            ? error.message
            : error instanceof z.ZodError
              ? "Choose a file within the 20 MB attachment limit."
              : "Attachment outcome could not be confirmed. Check the draft before trying again.",
      },
      {
        status:
          error instanceof AttachmentUploadError
            ? error.status
            : error instanceof z.ZodError
              ? 400
              : 503,
      },
    );
  }
}
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
