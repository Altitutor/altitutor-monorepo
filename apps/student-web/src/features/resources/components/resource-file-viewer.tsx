'use client';

import { useMemo } from 'react';
import { parseExternalVideoEmbed } from '@altitutor/shared';

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

  if (videoEmbed) {
    return (
      <div className="space-y-3">
        <h2 className="text-xl font-semibold">{filename}</h2>
        <div className="relative aspect-video w-full overflow-hidden rounded-md border">
          <iframe
            src={videoEmbed.embedUrl}
            title={filename}
            className="absolute inset-0 h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  if (externalUrl && !videoEmbed) {
    return (
      <div className="space-y-3">
        <h2 className="text-xl font-semibold">{filename}</h2>
        <p className="text-sm text-muted-foreground">This resource is hosted outside Altitutor.</p>
        <p className="break-all font-mono text-xs text-muted-foreground">{externalUrl}</p>
      </div>
    );
  }

  if (!signedUrl) {
    return <p className="text-sm text-muted-foreground">File preview unavailable.</p>;
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">{filename}</h2>

      {isPdf ? (
        <iframe src={signedUrl} title={filename} className="h-[70dvh] w-full rounded-md border" />
      ) : null}

      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={signedUrl} alt={filename} className="max-h-[70dvh] w-auto rounded-md border" />
      ) : null}

      {!isPdf && !isImage ? (
        <p className="text-sm text-muted-foreground">This file type cannot be previewed inline.</p>
      ) : null}
    </div>
  );
}
