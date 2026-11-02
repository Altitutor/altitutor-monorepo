'use client';

import { useCallback, useMemo, useRef } from 'react';
import { parseExternalVideoEmbed } from '@altitutor/shared';
import { Button } from '@altitutor/ui';
import { ResourcePdfPages } from './resource-pdf-pages';

function isPdfResource(mimetype: string | null, filename: string): boolean {
  return (
    (mimetype ?? '').toLowerCase().includes('pdf') ||
    filename.toLowerCase().endsWith('.pdf')
  );
}

export function ResourceFileViewer({
  filename,
  mimetype,
  resourceType,
  externalUrl,
  signedUrl,
  frameClassName,
  onRetry,
  isRetrying = false,
}: {
  filename: string;
  mimetype: string | null;
  resourceType: string;
  externalUrl: string | null;
  signedUrl: string | null;
  frameClassName?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
}) {
  const isPdf = isPdfResource(mimetype, filename);
  const isImage = useMemo(
    () => (mimetype ?? '').startsWith('image/'),
    [mimetype],
  );
  const pdfIdentity = `${filename}\u0000${mimetype ?? ''}\u0000${resourceType}\u0000${externalUrl ?? ''}`;
  const loadedPdfRef = useRef<{ identity: string; url: string | null }>({
    identity: pdfIdentity,
    url: null,
  });
  if (loadedPdfRef.current.identity !== pdfIdentity) {
    loadedPdfRef.current = { identity: pdfIdentity, url: null };
  }
  const handlePdfReady = useCallback(
    (loadedUrl: string) => {
      if (loadedPdfRef.current.identity === pdfIdentity) {
        loadedPdfRef.current.url = loadedUrl;
      }
    },
    [pdfIdentity],
  );

  const videoEmbed = useMemo(() => {
    if (resourceType !== 'VIDEO' || !externalUrl) {
      return null;
    }
    return parseExternalVideoEmbed(externalUrl);
  }, [resourceType, externalUrl]);

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
        <p className="text-sm text-muted-foreground">
          This resource is hosted outside Altitutor.
        </p>
        <p className="break-all font-mono text-xs text-muted-foreground">
          {externalUrl}
        </p>
      </div>
    );
  }

  if (!signedUrl) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">File preview unavailable.</p>
        {onRetry ? <Button type="button" variant="outline" disabled={isRetrying} onClick={onRetry}>
          {isRetrying ? 'Retrying…' : 'Retry file'}
        </Button> : null}
      </div>
    );
  }

  if (isPdf) {
    const previewUrl = loadedPdfRef.current.url ?? signedUrl;
    return (
      <ResourcePdfPages
        url={previewUrl}
        filename={filename}
        onReady={handlePdfReady}
        onRetry={onRetry}
        isRetrying={isRetrying}
        className={[
          'h-[calc(100dvh-var(--navbar-height)-4rem)] w-full',
          frameClassName,
        ]
          .filter(Boolean)
          .join(' ')}
      />
    );
  }

  if (isImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={signedUrl}
        alt={filename}
        className="sticky top-4 block max-h-[calc(100dvh-var(--navbar-height)-4rem)] w-auto rounded-md border"
      />
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      This file type cannot be previewed inline.
    </p>
  );
}
