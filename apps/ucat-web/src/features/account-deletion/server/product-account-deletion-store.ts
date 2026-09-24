import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import { getUcatSubjectId } from "@/lib/ucat/ucat-subject-id";
import type {
  ManageableSubscription,
  ProductAccountDeletionStore,
  StudentDeletionRecord,
} from "@/features/account-deletion/delete-ucat-product-account";

type AdminClient = SupabaseClient<Database>;

const OPEN_SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "unpaid",
  "incomplete",
  "paused",
] as const;

export function createProductAccountDeletionStore(
  admin: AdminClient,
): ProductAccountDeletionStore {
  return {
    async loadStudent(userId): Promise<StudentDeletionRecord | null> {
      const { data, error } = await admin
        .from("students")
        .select("id, first_name, last_name, status")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        firstName: data.first_name,
        lastName: data.last_name,
        inPersonStatus: data.status,
      };
    },
    async hasStaffLogin(userId): Promise<boolean> {
      const { data, error } = await admin
        .from("staff")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data !== null;
    },
    async loadManageableSubscriptions(
      studentId,
    ): Promise<ManageableSubscription[]> {
      const subjectId = await getUcatSubjectId(admin);
      if (!subjectId) return [];
      const { data, error } = await admin
        .from("student_subscriptions")
        .select("id, stripe_subscription_id")
        .eq("student_id", studentId)
        .eq("subject_id", subjectId)
        .in("status", [...OPEN_SUBSCRIPTION_STATUSES]);
      if (error) throw error;
      return (data ?? []).flatMap((row) =>
        row.stripe_subscription_id
          ? [
              {
                id: row.id,
                stripeSubscriptionId: row.stripe_subscription_id,
              },
            ]
          : [],
      );
    },
    async markSubscriptionCanceled(subscriptionId, canceledAt) {
      const { error } = await admin
        .from("student_subscriptions")
        .update({
          status: "canceled",
          cancel_at_period_end: false,
          cancel_at: canceledAt,
          billing_recovery_invoice_id: null,
          billing_recovery_started_at: null,
          billing_recovery_next_attempt_at: null,
          billing_recovery_failure_code: null,
          billing_recovery_requires_action: false,
          updated_at: canceledAt,
        })
        .eq("id", subscriptionId);
      if (error) throw error;
    },
    async deleteLearningData(studentId) {
      const { error } = await admin.rpc("delete_ucat_product_learning_data", {
        p_student_id: studentId,
      });
      if (error) throw error;
    },
    async unlinkLogin(studentId) {
      const { error } = await admin
        .from("students")
        .update({ user_id: null, updated_at: new Date().toISOString() })
        .eq("id", studentId);
      if (error) throw error;
    },
    async relinkLogin(studentId, userId) {
      const { error } = await admin
        .from("students")
        .update({ user_id: userId, updated_at: new Date().toISOString() })
        .eq("id", studentId);
      if (error) throw error;
    },
  };
}
