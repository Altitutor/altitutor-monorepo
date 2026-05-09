'use client';

import Link from 'next/link';
import { Button } from '@altitutor/ui';
import { studentCardCn } from '@/shared/lib/student-visual';

export function ResourceAccessDenied() {
  return (
    <div className={studentCardCn('p-8 text-center sm:p-10')}>
      <h1 className="text-3xl font-bold tracking-tight">Access Required</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        You currently do not have access to this resource. If you think this is incorrect, please contact support.
      </p>
      <div className="mt-4">
        <Button asChild variant="outline">
          <Link href="/resources">Back to Resources</Link>
        </Button>
      </div>
    </div>
  );
}
