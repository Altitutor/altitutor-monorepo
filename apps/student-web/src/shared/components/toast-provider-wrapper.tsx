'use client';

import { ToastProvider } from '@altitutor/ui';

export function ToastProviderWrapper({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}


