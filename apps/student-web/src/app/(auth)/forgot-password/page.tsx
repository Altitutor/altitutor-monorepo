import { ForgotPasswordForm, LoginPageLayout } from '@/features/auth/components';

export default function ForgotPasswordPage() {
  return (
    <LoginPageLayout
      title="Reset password"
      subtitle="Enter your email and we'll send you a link to choose a new password."
      footer={null}
    >
      <ForgotPasswordForm />
    </LoginPageLayout>
  );
}
