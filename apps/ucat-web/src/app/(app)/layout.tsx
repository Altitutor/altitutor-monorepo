import type React from 'react'
import { AppShell } from '@/features/layout'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  return <AppShell>{children}</AppShell>
}
