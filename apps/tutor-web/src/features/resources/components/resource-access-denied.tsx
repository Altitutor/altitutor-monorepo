'use client';

import Link from 'next/link';
import { Button } from '@altitutor/ui';
import { tutorCardCn } from '@/shared/lib/tutor-visual';

export function ResourceAccessDenied() {
  return (
    <div className={tutorCardCn('p-8 text-center sm:p-10')}>
      <h1 className="text-3xl font-bold tracking-tight">Not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This resource is not available for your account, or the link may be incorrect.
      </p>
      <div className="mt-4">
        <Button asChild variant="outline">
          <Link href="/resources">Back to Resources</Link>
        </Button>
      </div>
    </div>
  );
}
