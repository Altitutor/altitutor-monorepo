'use client';

import { useRouter } from 'next/navigation';
import { IssueDetailView } from './IssueDetailView';

interface IssueDetailPageProps {
  issueId: string;
}

export function IssueDetailPage({ issueId }: IssueDetailPageProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col h-[calc(100dvh-var(--navbar-height)-64px)] overflow-hidden">
      <IssueDetailView
        issueId={issueId}
        enabled
        variant="page"
        onClose={() => router.push('/issues')}
      />
    </div>
  );
}
