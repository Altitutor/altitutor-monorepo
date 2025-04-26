import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div className="h-[calc(100vh-var(--navbar-height))] flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <LoginForm />
    </div>
  );
} 