export type AbsenceBillingTreatment = 'none' | 'charge' | 'credit' | 'replacement';

export interface StoredAbsenceBillingState {
  plannedAbsence: boolean;
  isCredited: boolean;
  isRescheduled: boolean;
}

export function deriveAbsenceBillingTreatment(
  state: StoredAbsenceBillingState
): AbsenceBillingTreatment {
  if (state.isCredited && state.isRescheduled) {
    throw new Error('A Planned absence cannot be both credited and rescheduled');
  }
  if (!state.plannedAbsence) return 'none';
  if (state.isCredited) return 'credit';
  if (state.isRescheduled) return 'replacement';
  return 'charge';
}

export interface SessionBillingObligationInput {
  amountCents: number;
  isBillable: boolean;
  wasTrial: boolean;
  plannedAbsence: boolean;
  absenceBillingTreatment: AbsenceBillingTreatment;
  actualAttendance: boolean | null;
}

export type SessionBillingObligationReason =
  | 'chargeable'
  | 'not_billable'
  | 'trial'
  | 'credited_absence'
  | 'replacement_absence';

export interface SessionBillingObligation {
  amountCents: number;
  reason: SessionBillingObligationReason;
}

export function getSessionBillingObligation(
  input: SessionBillingObligationInput
): SessionBillingObligation {
  if (!input.isBillable) return { amountCents: 0, reason: 'not_billable' };
  if (input.wasTrial) return { amountCents: 0, reason: 'trial' };
  if (
    input.plannedAbsence &&
    input.actualAttendance !== true &&
    input.absenceBillingTreatment === 'credit'
  ) {
    return { amountCents: 0, reason: 'credited_absence' };
  }
  if (
    input.plannedAbsence &&
    input.actualAttendance !== true &&
    input.absenceBillingTreatment === 'replacement'
  ) {
    return { amountCents: 0, reason: 'replacement_absence' };
  }
  return { amountCents: input.amountCents, reason: 'chargeable' };
}
