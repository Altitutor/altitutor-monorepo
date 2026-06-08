import Link from "next/link";
import { MARKETING_TOKENS } from "@altitutor/shared";
import { LoginPageLayout, ResetPasswordForm } from "@/features/auth";
import { cn } from "@/lib/utils";

const { typography: typo } = MARKETING_TOKENS;

export default function ResetPasswordPage() {
  return (
    <LoginPageLayout
      title="Choose a new password"
      subtitle="Enter a new password for your account."
      footer={
        <p
          className={cn(
            "mt-6 text-center text-sm text-muted-foreground",
            typo.secondarySans,
          )}
        >
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-2 transition-colors hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      }
    >
      <ResetPasswordForm />
    </LoginPageLayout>
  );
}
