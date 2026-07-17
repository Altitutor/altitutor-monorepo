"use client";

import { ToastProvider } from "@altitutor/ui";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ReactQueryProvider } from "@/lib/react-query/provider";
import { AuthProvider } from "@/features/auth";
import { SubscriptionConfigPrefetch } from "@/features/subscription/components/subscription-config-prefetch";
import { UcatPostHogIdentity } from "@/lib/analytics/posthog-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ReactQueryProvider>
      <AuthProvider>
        <UcatPostHogIdentity />
        <SubscriptionConfigPrefetch />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </ReactQueryProvider>
  );
}
