import { ReconciliationFamilyTab } from '@/features/reconciliation/components/ReconciliationTabViews';
import { ReconciliationInteractionProvider } from '@/features/reconciliation/components/ReconciliationShell';

export default function FeedbackCheckInsRoute() {
  return (
    <ReconciliationInteractionProvider>
      <ReconciliationFamilyTab />
    </ReconciliationInteractionProvider>
  );
}
