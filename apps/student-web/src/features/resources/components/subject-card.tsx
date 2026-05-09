'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@altitutor/ui';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { ResourceSubject } from '../lib/types';
import { studentCardCn } from '@/shared/lib/student-visual';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=1200&auto=format&fit=crop';

export function SubjectCard({ subject, href }: { subject: ResourceSubject; href: string }) {
  const [signedImageUrl, setSignedImageUrl] = useState<string | null>(null);
  const title = subject.short_name || subject.name || 'Subject';

  useEffect(() => {
    let cancelled = false;

    async function loadImage() {
      if (!subject.image?.bucket || !subject.image.storage_path) {
        setSignedImageUrl(null);
        return;
      }

      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.storage
          .from(subject.image.bucket)
          .createSignedUrl(subject.image.storage_path, 3600);
        if (!cancelled && !error) {
          setSignedImageUrl(data.signedUrl);
        }
      } catch {
        if (!cancelled) setSignedImageUrl(null);
      }
    }

    void loadImage();
    return () => {
      cancelled = true;
    };
  }, [subject.image?.bucket, subject.image?.storage_path]);

  return (
    <Link href={href} className="block">
      <Card className={studentCardCn('overflow-hidden p-0 hover:-translate-y-0.5 hover:shadow-[0_14px_44px_rgb(0,0,0,0.09)]')}>
        <div className="h-36 w-full bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={signedImageUrl ?? FALLBACK_IMAGE} alt={title} className="h-full w-full object-cover" />
        </div>
        <CardContent className="p-4">
          <h3 className="text-lg font-semibold">{title}</h3>
        </CardContent>
      </Card>
    </Link>
  );
}
