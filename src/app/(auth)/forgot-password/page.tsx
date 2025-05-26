import { ForgotPasswordForm } from '@/features/auth/components/ForgotPasswordForm';

export default function ForgotPasswordPage() {
  return (
    <div className="h-[calc(100vh-var(--navbar-height))] flex items-center justify-center bg-gray-50 dark:bg-brand-dark-bg px-4">
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent to-brand-lightBlue/20 dark:to-brand-dark-card/50 z-0"></div>
      <div className="relative z-10">
        <ForgotPasswordForm />
      </div>
    </div>
  );
} 