import { ReconciliationShell } from '@/features/reconciliation';

export default function ReconciliationLayout({ children }: { children: React.ReactNode }) {
  return <ReconciliationShell>{children}</ReconciliationShell>;
}
