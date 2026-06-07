import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { SignupCompleteForm } from "@/features/auth";

export default async function SignupCompletePage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signup");
  }

  return (
    <SignupCompleteForm
      email={user.email ?? ""}
      redirectTo="/subscribe"
    />
  );
}
