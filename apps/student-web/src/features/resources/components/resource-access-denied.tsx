'use client';

import Link from 'next/link';
import type { UseQueryResult } from '@tanstack/react-query';
import { Button } from '@altitutor/ui';
import { studentBtnOutline, studentCardCn } from '@/shared/lib/student-visual';

type ResourceAccessDeniedProps = {
  accessCheck?: Pick<UseQueryResult, 'status' | 'isFetching' | 'refetch'>;
};

const noticeClassName = studentCardCn('p-8 text-center sm:p-10');

export function ResourceAccessDenied({ accessCheck }: ResourceAccessDeniedProps) {
  if (accessCheck?.status === 'pending') {
    return (
      <div role="status" className={noticeClassName}>
        Checking resource access…
      </div>
    );
  }

  if (accessCheck?.status === 'error') {
    return (
      <div className={noticeClassName}>
        <h1 className="text-3xl font-bold tracking-tight">Could not check resource access</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Please try again to check access to this resource.
        </p>
        <Button
          type="button"
          variant="outline"
          className={`${studentBtnOutline} mt-4`}
          disabled={accessCheck.isFetching}
          onClick={() => { void accessCheck.refetch(); }}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={noticeClassName}>
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
