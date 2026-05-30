'use client';

import type { StaffTierProgress } from '@altitutor/shared/pay-tiers';
import { PayTiersStaffTierCards } from './PayTiersStaffTierCards';

export function PayTiersStaffProgressTab({ progress }: { progress: StaffTierProgress }) {
  return <PayTiersStaffTierCards progress={progress} />;
}
