import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { SignupFlowForm } from "@/features/auth";

export default async function SignupFlowPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signup");
  }

  return (
    <SignupFlowForm
      email={user.email ?? ""}
      redirectTo="/subscribe"
    />
  );
}
