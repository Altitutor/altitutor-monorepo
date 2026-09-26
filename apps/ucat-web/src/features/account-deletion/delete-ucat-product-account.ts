export type StudentDeletionRecord = {
  id: string;
  firstName: string;
  lastName: string;
  inPersonStatus: string | null;
};

export type ManageableSubscription = {
  id: string;
  stripeSubscriptionId: string;
};

export type ProductAccountDeletionStore = {
  loadStudent: (userId: string) => Promise<StudentDeletionRecord | null>;
  hasStaffLogin: (userId: string) => Promise<boolean>;
  loadManageableSubscriptions: (
    studentId: string,
  ) => Promise<ManageableSubscription[]>;
  markSubscriptionCanceled: (
    subscriptionId: string,
    canceledAt: string,
  ) => Promise<void>;
  deleteLearningData: (studentId: string) => Promise<void>;
  unlinkLogin: (studentId: string) => Promise<void>;
  relinkLogin: (studentId: string, userId: string) => Promise<void>;
};

export type DeleteUcatProductAccountResult =
  | { ok: true; loginRemoved: boolean; studentId: string }
  | {
      ok: false;
      error:
        | "not_found"
        | "name_mismatch"
        | "billing_unavailable"
        | "billing_failed"
        | "deletion_failed";
    };

export class BillingUnavailableError extends Error {
  constructor() {
    super("Billing is unavailable");
    this.name = "BillingUnavailableError";
  }
}

export function confirmedFullNameMatches(
  firstName: string,
  lastName: string,
  typed: string,
): boolean {
  const expected = normalizeName(`${firstName} ${lastName}`);
  const given = normalizeName(typed);
  return expected.length > 0 && expected === given;
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export async function deleteUcatProductAccount(input: {
  userId: string;
  fullName: string;
  store: ProductAccountDeletionStore;
  cancelStripeSubscription: (stripeSubscriptionId: string) => Promise<void>;
  deleteAuthUser: (userId: string) => Promise<void>;
}): Promise<DeleteUcatProductAccountResult> {
  const student = await input.store.loadStudent(input.userId);
  if (!student) return { ok: false, error: "not_found" };
  if (
    !confirmedFullNameMatches(
      student.firstName,
      student.lastName,
      input.fullName,
    )
  ) {
    return { ok: false, error: "name_mismatch" };
  }

  const [staffLogin, subscriptions] = await Promise.all([
    input.store.hasStaffLogin(input.userId),
    input.store.loadManageableSubscriptions(student.id),
  ]);

  for (const subscription of subscriptions) {
    try {
      await input.cancelStripeSubscription(subscription.stripeSubscriptionId);
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof BillingUnavailableError
            ? "billing_unavailable"
            : "billing_failed",
      };
    }
    await input.store.markSubscriptionCanceled(
      subscription.id,
      new Date().toISOString(),
    );
  }

  try {
    await input.store.deleteLearningData(student.id);
  } catch {
    return { ok: false, error: "deletion_failed" };
  }

  if (student.inPersonStatus !== null || staffLogin) {
    return { ok: true, loginRemoved: false, studentId: student.id };
  }

  try {
    await input.store.unlinkLogin(student.id);
    await input.deleteAuthUser(input.userId);
  } catch {
    try {
      await input.store.relinkLogin(student.id, input.userId);
    } catch {
      return { ok: false, error: "deletion_failed" };
    }
    return { ok: false, error: "deletion_failed" };
  }

  return { ok: true, loginRemoved: true, studentId: student.id };
}
