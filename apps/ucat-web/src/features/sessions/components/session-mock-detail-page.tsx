"use client";

import { MockDetailPage } from "@/features/mocks";
import { useStudentUcatSessions } from "@/features/sessions/hooks/use-sessions";
import { formatSessionBreadcrumbDate } from "@/features/sessions/lib/format-session-breadcrumb-date";

type SessionMockDetailPageProps = {
  sessionId: string;
  mockId: string;
};

export function SessionMockDetailPage({
  sessionId,
  mockId,
}: SessionMockDetailPageProps) {
  const { data: sessions } = useStudentUcatSessions();
  const session = sessions?.find((s) => s.session_id === sessionId);
  const breadcrumbDateLabel = formatSessionBreadcrumbDate(session?.start_at);

  return (
    <MockDetailPage
      mockId={mockId}
      sessionEntryContext={{
        sessionId,
        breadcrumbDateLabel,
      }}
    />
  );
}
