import { LoginForm, LoginPageLayout } from "@/features/auth";

type PageProps = {
  searchParams: Promise<{ redirect?: string }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const redirectTo =
    params.redirect && params.redirect.startsWith("/")
      ? params.redirect
      : "/dashboard";
  return (
    <LoginPageLayout>
      <LoginForm redirectTo={redirectTo} />
    </LoginPageLayout>
  );
}
