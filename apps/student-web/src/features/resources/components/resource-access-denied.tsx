'use client';

import Link from 'next/link';
import { Button } from '@altitutor/ui';
import { studentBtnOutline, studentCardCn } from '@/shared/lib/student-visual';

type AccessVerification = {
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
};

const accessCardClass = studentCardCn('p-8 text-center sm:p-10');

export function ResourceAccessDenied({ verification }: { verification?: AccessVerification }) {
  if (verification?.isPending) {
    return (
      <div className={accessCardClass} role="status">
        Checking resource access…
      </div>
    );
  }

  if (verification?.isError) {
    return (
      <div className={accessCardClass}>
        <h1 className="text-3xl font-bold tracking-tight">Couldn’t verify resource access</h1>
        <p className="mt-2 text-sm text-muted-foreground" role="alert">
          Check your connection and try again.
        </p>
        <div className="mt-4">
          <Button
            type="button"
            variant="outline"
            className={studentBtnOutline}
            disabled={verification.isFetching}
            onClick={() => { void verification.refetch(); }}
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={accessCardClass}>
      <h1 className="text-3xl font-bold tracking-tight">Access Required</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        You currently do not have access to this resource. If you think this is incorrect, please contact support.
      </p>
      <div className="mt-4">
        <Button asChild variant="outline" className={studentBtnOutline}>
          <Link href="/resources">Back to Resources</Link>
        </Button>
      </div>
    </div>
  );
}
