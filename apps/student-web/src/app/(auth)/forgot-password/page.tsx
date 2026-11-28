import { ForgotPasswordForm, LoginPageLayout } from '@/features/auth/components';

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;
  return (
    <LoginPageLayout
      title="Reset password"
      subtitle="Enter your email and we'll send you a link to choose a new password."
      footer={null}
    >
      <ForgotPasswordForm initialError={typeof error === 'string' ? error : undefined} />
    </LoginPageLayout>
  );
}
