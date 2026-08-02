import { LoginForm, LoginPageLayout } from "@/features/auth";
import { getEnabledSocialAuthProviders } from "@/features/auth/lib/social-auth";
import { safePostAuthReturnPath } from "@/features/auth/lib/return-intent";

type PageProps = {
  searchParams: Promise<{
    redirect?: string;
    email?: string;
    existing?: string;
    reset?: string;
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const redirectTo = safePostAuthReturnPath(params.redirect);
  const initialEmail = params.email?.trim() ?? "";
  const accountExists = params.existing === "1";
  const resetSuccess = params.reset === "success";
  return (
    <LoginPageLayout redirectTo={redirectTo}>
      <LoginForm
        redirectTo={redirectTo}
        initialEmail={initialEmail}
        accountExists={accountExists}
        resetSuccess={resetSuccess}
        enabledSocialProviders={getEnabledSocialAuthProviders()}
        authError={params.error}
      />
    </LoginPageLayout>
  );
}
