import type React from 'react'
import { AppShell } from '@/features/layout'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
  detail: React.ReactNode
}

export default function AuthenticatedLayout({ children, detail }: AuthenticatedLayoutProps) {
  return <AppShell detail={detail}>{children}</AppShell>
}
