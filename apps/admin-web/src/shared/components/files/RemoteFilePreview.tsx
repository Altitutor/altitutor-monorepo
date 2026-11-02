"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Download, File, LoaderCircle } from "lucide-react";
import { Button } from "@altitutor/ui";
import { AdminDialogShell } from "@/shared/components/dialog-shell";

/** Files owned by another provider can use the same dialog without a files-table row. */
export type RemotePreviewFile = {
  name: string;
  contentType: string;
  url: string;
  downloadUrl: string;
};
export function RemoteFilePreview({
  source,
  isOpen,
  onClose,
}: {
  source: RemotePreviewFile;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [preview, setPreview] = useState<string>();
  const [error, setError] = useState(false);
  const supportedImage = /^image\/(?:png|jpeg|gif|webp|avif)$/i.test(
    source.contentType,
  );
  const supported = supportedImage || source.contentType === "application/pdf";
  useEffect(() => {
    if (!isOpen || !supported) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    setPreview(undefined);
    setError(false);
    void fetch(source.url, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Preview unavailable");
        // A transient browser Blob avoids PDF range requests and is released on close.
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setPreview(objectUrl);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isOpen, source.url, supported]);
  return (
    <AdminDialogShell
      open={isOpen}
      onClose={onClose}
      title={source.name}
      subtitle="Email attachment"
      fillHeight
      contentClassName="md:max-w-4xl"
      bodyClassName="flex min-h-0 flex-1 flex-col p-0"
      headerActions={
        <Button variant="outline" size="sm" asChild>
          <a href={source.downloadUrl} download={source.name}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </a>
        </Button>
      }
    >
      {error ? (
        <p role="alert" className="p-6 text-sm text-destructive">
          Could not preview this file. You can download it instead.
        </p>
      ) : !supported ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
          <File className="h-12 w-12" />
          <p className="text-sm">Preview not available for this file type</p>
        </div>
      ) : !preview ? (
        <div
          role="status"
          aria-label="Loading file preview"
          className="flex flex-1 items-center justify-center"
        >
          <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : supportedImage ? (
        <div className="relative min-h-0 flex-1">
          <Image
            src={preview}
            alt={source.name}
            fill
            unoptimized
            className="object-contain"
          />
        </div>
      ) : (
        <iframe
          src={preview}
          title={source.name}
          className="min-h-0 w-full flex-1 border-0"
        />
      )}
    </AdminDialogShell>
  );
}
