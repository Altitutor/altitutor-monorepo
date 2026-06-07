"use client";

import Link from "next/link";
import { MARKETING_TOKENS } from "@altitutor/shared";
import { AuthPageHeader } from "@/features/auth/components/auth-page-header";
import { cn } from "@/lib/utils";

const { typography: typo } = MARKETING_TOKENS;

export function LoginPageLayout({
  children,
  redirectTo = "/dashboard",
  title = "Log in",
  subtitle = "Ready to continue practicing? Log in below.",
  footer,
}: {
  children: React.ReactNode;
  redirectTo?: string;
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode | null;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-background text-foreground">
      <AuthPageHeader />

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="auth-entrance w-full max-w-md">
          <div className="mb-10">
            <span
              className={cn(
                "text-xs font-bold uppercase tracking-[0.2em] text-primary",
                typo.dataMono,
              )}
            >
              Alti UCAT
            </span>
            <h1
              className={cn(
                "mt-2 text-4xl font-bold leading-tight text-foreground sm:text-5xl",
                typo.headingSans,
              )}
            >
              {title}
            </h1>
            <p className={cn("mt-3 text-muted-foreground", typo.secondarySans)}>{subtitle}</p>
          </div>
          {children}
          {footer === null ? null : footer ?? (
            <p
              className={cn(
                "mt-6 text-center text-sm text-muted-foreground",
                typo.secondarySans,
              )}
            >
              Don&apos;t have an account?{" "}
              <Link
                href={`/signup?redirect=${encodeURIComponent(redirectTo)}`}
                className="font-medium text-primary underline-offset-2 transition-colors hover:underline"
              >
                Sign up
              </Link>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
