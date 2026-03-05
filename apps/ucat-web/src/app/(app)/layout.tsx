import type React from 'react'
import { AppShell } from '@/features/layout'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
  detail: React.ReactNode
  params?: unknown
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  return <AppShell>{children}</AppShell>
}
