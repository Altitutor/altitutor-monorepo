'use client';

import { IssueDetailPage } from '@/features/issues/components/IssueDetailPage';

export default function IssueDetailRoute({ params }: { params: { id: string } }) {
  return <IssueDetailPage issueId={params.id} />;
}
