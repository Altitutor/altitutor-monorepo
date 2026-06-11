'use client'

import { createContext, useContext } from 'react'

export type UcatReconciliationHandlers = {
  onOpenStemDialog: (stemId: string) => void
  onEditSet: (setId: string) => void
  onEditMock: (mockId: string) => void
}

const UcatReconciliationContext = createContext<UcatReconciliationHandlers | null>(null)

export function UcatReconciliationProvider({
  value,
  children,
}: {
  value: UcatReconciliationHandlers
  children: React.ReactNode
}) {
  return <UcatReconciliationContext.Provider value={value}>{children}</UcatReconciliationContext.Provider>
}

export function useUcatReconciliationHandlers(): UcatReconciliationHandlers {
  const context = useContext(UcatReconciliationContext)
  if (!context) {
    throw new Error('useUcatReconciliationHandlers must be used within UcatReconciliationProvider')
  }
  return context
}
