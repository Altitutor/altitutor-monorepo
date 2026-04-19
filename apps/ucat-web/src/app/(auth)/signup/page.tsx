import { SignupForm, LoginPageLayout } from "@/features/auth";

type PageProps = {
  searchParams: Promise<{ redirect?: string }>;
};

export default async function SignupPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const redirectTo =
    params.redirect && params.redirect.startsWith("/")
      ? params.redirect
      : "/subscribe";
  return (
    <LoginPageLayout>
      <SignupForm redirectTo={redirectTo} />
    </LoginPageLayout>
  );
}
