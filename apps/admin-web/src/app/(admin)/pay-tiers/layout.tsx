import { PayTiersShell } from '@/features/pay-tiers/components/PayTiersShell';

export default function PayTiersLayout({ children }: { children: React.ReactNode }) {
  return <PayTiersShell>{children}</PayTiersShell>;
}
