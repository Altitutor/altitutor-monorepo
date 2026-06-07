import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { SignupCompleteForm } from "@/features/auth";
import {
  isProfileSetupComplete,
  loadSignupProfileInitial,
} from "@/features/auth/lib/signup-profile";

export default async function SignupCompletePage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signup");
  }

  if (isProfileSetupComplete(user.user_metadata)) {
    redirect("/subscribe");
  }

  const initialProfile = await loadSignupProfileInitial(user.id);

  return (
    <SignupCompleteForm
      email={user.email ?? ""}
      redirectTo="/subscribe"
      initialFirstName={initialProfile.firstName}
      initialLastName={initialProfile.lastName}
      initialPhone={initialProfile.phone}
    />
  );
}
