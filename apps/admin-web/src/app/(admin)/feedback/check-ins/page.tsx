import { CheckInsPage } from '@/features/feedback/components/CheckInsPage';
import { ReconciliationInteractionProvider } from '@/features/reconciliation/components/ReconciliationShell';

export default function FeedbackCheckInsRoute() {
  return (
    <ReconciliationInteractionProvider>
      <CheckInsPage />
    </ReconciliationInteractionProvider>
  );
}
