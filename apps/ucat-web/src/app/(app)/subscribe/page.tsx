import { redirect } from "next/navigation";
import { Suspense } from "react";
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
        redirect("/settings/subscription");
      }
    }
  }

  return (
    <Suspense fallback={<SubscribePageSkeleton />}>
      <SubscribePage />
    </Suspense>
  );
}

function SubscribePageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-9 w-56 rounded bg-muted" />
        <div className="h-4 max-w-xl rounded bg-muted" />
      </div>
      <div className="h-40 rounded-lg border border-border bg-muted/50" />
    </div>
  );
}
