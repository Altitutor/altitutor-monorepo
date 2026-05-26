'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, CardContent, Skeleton } from '@altitutor/ui';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { ResourceSubject } from '../lib/types';
import { tutorCardCn } from '@/shared/lib/tutor-visual';

function SubjectCoverPlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted ring-1 ring-inset ring-border/50">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/logo-icon-light.svg"
        alt=""
        className="h-14 w-14 opacity-90 dark:hidden"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/logo-icon-dark.svg"
        alt=""
        className="hidden h-14 w-14 opacity-90 dark:block"
      />
    </div>
  );
}

export function SubjectCard({ subject, href }: { subject: ResourceSubject; href: string }) {
  const [signedImageUrl, setSignedImageUrl] = useState<string | null>(null);
  const [isSigningUrl, setIsSigningUrl] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const title = subject.long_name || subject.name || 'Subject';

  useEffect(() => {
    let cancelled = false;
    setImageLoaded(false);
    setSignedImageUrl(null);

    const image = subject.image;
    if (!image?.bucket || !image.storage_path) {
      setIsSigningUrl(false);
      return;
    }

    const bucket = image.bucket;
    const storagePath = image.storage_path;

    setIsSigningUrl(true);

    async function loadImage() {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(storagePath, 3600);
        if (cancelled) return;
        if (!error && data?.signedUrl) {
          setSignedImageUrl(data.signedUrl);
        }
      } catch {
        if (!cancelled) setSignedImageUrl(null);
      } finally {
        if (!cancelled) setIsSigningUrl(false);
      }
    }

    void loadImage();
    return () => {
      cancelled = true;
    };
  }, [subject.image]);

  const showSkeleton = isSigningUrl || Boolean(signedImageUrl && !imageLoaded);
  const showPlaceholder = !signedImageUrl && !isSigningUrl;

  return (
    <Link href={href} className="block">
      <Card
        className={tutorCardCn(
          'overflow-hidden p-0 hover:-translate-y-0.5 hover:shadow-[0_14px_44px_rgb(0,0,0,0.09)]',
        )}
      >
        <div className="relative h-36 w-full overflow-hidden bg-muted">
          {showSkeleton ? (
            <Skeleton className="absolute inset-0 z-10 h-full w-full rounded-none" />
          ) : null}
          {signedImageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={signedImageUrl}
              alt={title}
              className="h-full w-full object-cover"
              onLoad={() => setImageLoaded(true)}
              onError={() => {
                setSignedImageUrl(null);
                setImageLoaded(false);
              }}
            />
          ) : null}
          {showPlaceholder ? <SubjectCoverPlaceholder /> : null}
        </div>
        <CardContent className="p-4">
          <h3 className="text-lg font-semibold">{title}</h3>
        </CardContent>
      </Card>
    </Link>
  );
}
