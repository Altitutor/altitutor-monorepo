import { ForgotPasswordForm, LoginPageLayout } from "@/features/auth";

type PageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function ForgotPasswordPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const initialError = params.error?.trim() || null;

  return (
    <LoginPageLayout
      title="Reset password"
      subtitle="Enter your email and we'll send you a link to choose a new password."
      footer={null}
    >
      <ForgotPasswordForm initialError={initialError} />
    </LoginPageLayout>
  );
}
