'use client';

import { useMemo } from 'react';
import { parseExternalVideoEmbed } from '@altitutor/shared';

/**
 * Append PDF viewer hash params that hide the toolbar (and therefore
 * the download button) on browsers that honour them (Chrome / Edge /
 * Safari built-in PDF viewers). Fully removing only the download button
 * isn't possible across all browsers without bundling pdf.js, so we
 * hide the whole toolbar.
 */
function withPdfViewerParams(url: string): string {
  const separator = url.includes('#') ? '&' : '#';
  return `${url}${separator}toolbar=0&navpanes=0`;
}

export function ResourceFileViewer({
  filename,
  mimetype,
  resourceType,
  externalUrl,
  signedUrl,
}: {
  filename: string;
  mimetype: string | null;
  resourceType: string;
  externalUrl: string | null;
  signedUrl: string | null;
}) {
  const isPdf = useMemo(() => (mimetype ?? '').includes('pdf'), [mimetype]);
  const isImage = useMemo(() => (mimetype ?? '').startsWith('image/'), [mimetype]);

  const videoEmbed = useMemo(() => {
    if (resourceType !== 'VIDEO' || !externalUrl) {
      return null;
    }
    return parseExternalVideoEmbed(externalUrl);
  }, [resourceType, externalUrl]);

  const pdfSrc = useMemo(
    () => (signedUrl && isPdf ? withPdfViewerParams(signedUrl) : null),
    [signedUrl, isPdf],
  );

  if (videoEmbed) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-md border">
        <iframe
          src={videoEmbed.embedUrl}
          title={filename}
          className="absolute inset-0 h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    );
  }

  if (externalUrl && !videoEmbed) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">This resource is hosted outside Altitutor.</p>
        <p className="break-all font-mono text-xs text-muted-foreground">{externalUrl}</p>
      </div>
    );
  }

  if (!signedUrl) {
    return <p className="text-sm text-muted-foreground">File preview unavailable.</p>;
  }

  if (isPdf && pdfSrc) {
    return <iframe src={pdfSrc} title={filename} className="h-[80dvh] w-full rounded-md border" />;
  }

  if (isImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={signedUrl} alt={filename} className="max-h-[80dvh] w-auto rounded-md border" />
    );
  }

  return <p className="text-sm text-muted-foreground">This file type cannot be previewed inline.</p>;
}
