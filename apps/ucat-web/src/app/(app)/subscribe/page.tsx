import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppPageSkeleton } from "@/features/layout/components/app-page-skeleton";
import { SubscribePage } from "@/features/subscription";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getStudentIdForUser,
  getUcatSubscriptionForStudent,
} from "@/lib/ucat/ucat-subscription";

export default async function Page() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && supabaseAdmin) {
    const studentId = await getStudentIdForUser(supabaseAdmin, user.id);
    if (studentId) {
      const subscription = await getUcatSubscriptionForStudent(
        supabaseAdmin,
        studentId,
      );
      if (subscription) {
        redirect("/settings/plan");
      }
    }
  }

  return (
    <Suspense fallback={<AppPageSkeleton />}>
      <SubscribePage />
    </Suspense>
  );
}
