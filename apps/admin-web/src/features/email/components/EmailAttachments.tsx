"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Paperclip, Trash2 } from "lucide-react";
import { FilePreviewModal } from "@/shared/components/files/FilePreviewModal";
import { mailRequest } from "../api/client";
import { EmailIconButton } from "./EmailIconButton";

export const emailAttachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.number().nonnegative(),
  contentType: z.string(),
  type: z.string(),
});
export type EmailAttachment = z.infer<typeof emailAttachmentSchema>;
export const emailAttachmentKey = (id: string) => ["email", "attachments", id];
export function EmailAttachments({
  id,
  enabled = true,
  onRemove,
  disabled = false,
}: {
  id: string;
  enabled?: boolean;
  onRemove?: (file: EmailAttachment) => void;
  disabled?: boolean;
}) {
  const [preview, setPreview] = useState<EmailAttachment>();
  const files = useQuery({
    queryKey: emailAttachmentKey(id),
    enabled: enabled && !id.startsWith("local:"),
    queryFn: async () =>
      z
        .array(emailAttachmentSchema)
        .parse(await mailRequest(`/attachments?id=${encodeURIComponent(id)}`)),
    staleTime: 30_000,
  });
  const downloadUrl = (file: EmailAttachment) =>
    `/api/email/attachments?id=${encodeURIComponent(id)}&attachment=${encodeURIComponent(file.id)}`;
  if (!enabled) return null;
  return (
    <>
      <ul aria-label="Attached files" className="mt-3 flex flex-wrap gap-2">
        {files.data?.map((file) => (
          <li
            key={file.id}
            className="inline-flex max-w-full items-center gap-1 rounded-md border bg-muted/25 px-2 py-1 text-xs"
          >
            <Paperclip className="h-3 w-3 shrink-0" />
            {file.type === "#microsoft.graph.referenceAttachment" ? (
              <span>{file.name} · cloud attachment</span>
            ) : (
              <button
                type="button"
                className="min-w-0 truncate text-left hover:underline"
                aria-label={`Preview ${file.name}`}
                onClick={() => setPreview(file)}
              >
                {file.name}
              </button>
            )}
            {onRemove && (
              <EmailIconButton
                label={`Remove ${file.name}`}
                destructive
                variant="ghost"
                className="h-6 w-6 border-0"
                disabled={disabled}
                onClick={() => onRemove(file)}
              >
                <Trash2 className="h-3 w-3" />
              </EmailIconButton>
            )}
          </li>
        ))}
      </ul>
      {files.isLoading && (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          Loading attachments…
        </p>
      )}
      {files.error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          Could not load attachments.
        </p>
      )}
      {preview && (
        <FilePreviewModal
          isOpen
          onClose={() => setPreview(undefined)}
          source={{
            name: preview.name,
            contentType: preview.contentType,
            url: downloadUrl(preview) + "&preview=1",
            downloadUrl: downloadUrl(preview),
          }}
        />
      )}
    </>
  );
}
