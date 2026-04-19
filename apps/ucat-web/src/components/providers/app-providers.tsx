"use client";

import { ToastProvider } from "@altitutor/ui";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ReactQueryProvider } from "@/lib/react-query/provider";
import { AuthProvider } from "@/features/auth";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ReactQueryProvider>
      <AuthProvider>
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
