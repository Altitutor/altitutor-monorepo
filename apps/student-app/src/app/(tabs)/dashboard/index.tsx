import { DashboardHome } from '@/features/dashboard/dashboard-home';
import { useDueFlashcardCount } from '@/features/flashcards/flashcard-hooks';
import { useDashboardSessions, useRecentResources } from '@/hooks/use-student-data';
import { StudentScreen } from '@/components/student-ui';

export default function DashboardScreen() {
  const sessions = useDashboardSessions();
  const resources = useRecentResources();
  const due = useDueFlashcardCount();
  const refreshing = sessions.isRefetching || resources.isRefetching || due.isRefetching;

  return (
    <StudentScreen
      title="Dashboard"
      showHeaderActions
      refreshing={refreshing}
      onRefresh={() => {
        void sessions.refetch();
        void resources.refetch();
        void due.refetch();
      }}>
      <DashboardHome sessions={sessions} resources={resources} due={due} />
    </StudentScreen>
  );
}
