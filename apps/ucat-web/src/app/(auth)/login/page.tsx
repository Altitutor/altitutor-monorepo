import { LoginForm, LoginPageLayout } from "@/features/auth";

type PageProps = {
  searchParams: Promise<{ redirect?: string; email?: string; existing?: string }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const redirectTo =
    params.redirect && params.redirect.startsWith("/")
      ? params.redirect
      : "/dashboard";
  const initialEmail = params.email?.trim() ?? "";
  const accountExists = params.existing === "1";
  return (
    <LoginPageLayout redirectTo={redirectTo}>
      <LoginForm
        redirectTo={redirectTo}
        initialEmail={initialEmail}
        accountExists={accountExists}
      />
    </LoginPageLayout>
  );
}
