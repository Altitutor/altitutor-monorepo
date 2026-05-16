"use client";

import { SetDetailPage } from "@/features/sets";
import { useStudentUcatSessions } from "@/features/sessions/hooks/use-sessions";
import { formatSessionBreadcrumbDate } from "@/features/sessions/lib/format-session-breadcrumb-date";

type SessionSetDetailPageProps = {
  sessionId: string;
  setId: string;
};

export function SessionSetDetailPage({
  sessionId,
  setId,
}: SessionSetDetailPageProps) {
  const { data: sessions } = useStudentUcatSessions();
  const session = sessions?.find((s) => s.session_id === sessionId);
  const breadcrumbDateLabel = formatSessionBreadcrumbDate(session?.start_at);

  return (
    <SetDetailPage
      setId={setId}
      sessionEntryContext={{
        sessionId,
        breadcrumbDateLabel,
      }}
    />
  );
}
