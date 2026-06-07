import Link from "next/link";
import { MARKETING_TOKENS } from "@altitutor/shared";
import { ForgotPasswordForm, LoginPageLayout } from "@/features/auth";
import { cn } from "@/lib/utils";

const { typography: typo } = MARKETING_TOKENS;

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
      footer={
        <p
          className={cn(
            "mt-6 text-center text-sm text-muted-foreground",
            typo.secondarySans,
          )}
        >
          Remember your password?{" "}
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-2 transition-colors hover:underline"
          >
            Sign in
          </Link>
        </p>
      }
    >
      <ForgotPasswordForm initialError={initialError} />
    </LoginPageLayout>
  );
}
