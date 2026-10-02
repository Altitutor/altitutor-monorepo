'use client';

import { toastHotkey } from '@/shared/shortcuts/registry';
import { ToastProvider } from '@altitutor/ui';

export function ToastProviderWrapper({ children }: { children: React.ReactNode }) {
  return <ToastProvider hotkey={toastHotkey}>{children}</ToastProvider>;
}

