import { z } from "zod";
import { draftResponseSchema, type EmailMessage } from "../types";
import {
  MAX_EMAIL_ATTACHMENT_BYTES,
  SMALL_EMAIL_ATTACHMENT_BYTES,
  EMAIL_ATTACHMENT_CHUNK_BYTES,
} from "../attachment-policy";
import { mailRequest } from "./client";

const resultSchema = draftResponseSchema.extend({
  attachment: z.object({ id: z.string() }).optional(),
});
export class EmailAttachmentUploadError extends Error {
  constructor(
    message: string,
    public readonly draft?: EmailMessage,
  ) {
    super(message);
  }
}
function responseError(value: unknown) {
  const parsed = z.object({ error: z.string() }).safeParse(value);
  return parsed.success
    ? parsed.data.error
    : "Upload failed. Check the draft before trying again.";
}
/** XHR supplies real byte progress; completing the HTTP request still waits for
 * Microsoft and the cache to confirm the attachment. No chunks are replayed. */
function uploadForm(
  method: string,
  path: string,
  body: FormData,
  progress: (percent: number) => void,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(method, path);
    request.timeout = 120_000;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable)
        progress(Math.min(100, Math.floor((event.loaded / event.total) * 100)));
    };
    request.onerror =
      request.ontimeout =
      request.onabort =
        () =>
          reject(
            new Error(
              "Upload could not be confirmed. Check the draft before trying again.",
            ),
          );
    request.onload = () => {
      try {
        const value: unknown = JSON.parse(request.responseText);
        if (request.status < 200 || request.status >= 300)
          reject(new Error(responseError(value)));
        else resolve(value);
      } catch {
        reject(
          new Error(
            "Upload could not be confirmed. Check the draft before trying again.",
          ),
        );
      }
    };
    request.send(body);
  });
}
export async function uploadEmailAttachment(
  input: { id: string; changeKey: string; editToken: string; file: File },
  progress: (percent: number) => void,
) {
  const { file, ...draft } = input;
  if (file.size > MAX_EMAIL_ATTACHMENT_BYTES)
    throw new Error("Keep all attachments together within 20 MB.");
  progress(0);
  if (file.size < SMALL_EMAIL_ATTACHMENT_BYTES) {
    const body = new FormData();
    Object.entries(draft).forEach(([key, value]) => body.set(key, value));
    body.set("file", file);
    return resultSchema.parse(
      await uploadForm("POST", "/api/email/attachments", body, progress),
    );
  }
  const session = z
    .object({
      ticket: z.string(),
      chunkSize: z.number().int().positive().max(EMAIL_ATTACHMENT_CHUNK_BYTES),
    })
    .parse(
      await mailRequest("/attachments/upload", {
        ...draft,
        name: file.name,
        size: file.size,
        contentType: file.type || "application/octet-stream",
      }),
    );
  try {
    let offset = 0;
    while (offset < file.size) {
      const chunk = file.slice(offset, offset + session.chunkSize);
      const body = new FormData();
      body.set("ticket", session.ticket);
      body.set("offset", String(offset));
      body.set("file", chunk, file.name);
      const value = await uploadForm(
        "PUT",
        "/api/email/attachments/upload",
        body,
        (percent) =>
          progress(
            Math.floor(
              ((offset + (chunk.size * percent) / 100) / file.size) * 100,
            ),
          ),
      );
      const state = z
        .object({ state: z.string(), nextOffset: z.number().optional() })
        .parse(value);
      if (state.state === "saved" && offset + chunk.size === file.size)
        return resultSchema.parse(value);
      if (
        state.state !== "uploading" ||
        state.nextOffset !== offset + chunk.size
      )
        throw new Error(
          "Upload outcome changed. Check the draft before trying again.",
        );
      offset = state.nextOffset;
    }
    throw new Error("Attachment completion could not be confirmed.");
  } catch (error) {
    let latest: EmailMessage | undefined;
    try {
      const response = await fetch("/api/email/attachments/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket: session.ticket }),
        cache: "no-store",
      });
      if (response.ok)
        latest = resultSchema.parse(await response.json()).message;
    } catch {
      /* An unresolved capability expires; never replay the last chunk. */
    }
    throw new EmailAttachmentUploadError(
      error instanceof Error
        ? error.message
        : "Upload failed. Check the draft before trying again.",
      latest,
    );
  }
}
