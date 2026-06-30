'use client';

import React, { createContext, useContext, useMemo, useState } from 'react';

type AdminShellContextValue = {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
};

const AdminShellContext = createContext<AdminShellContextValue | null>(null);

export function AdminShellProvider({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const value = useMemo(
    () => ({
      sidebarCollapsed,
      toggleSidebar: () => setSidebarCollapsed((collapsed) => !collapsed),
    }),
    [sidebarCollapsed],
  );

  return (
    <AdminShellContext.Provider value={value}>
      {children}
    </AdminShellContext.Provider>
  );
}

export function useAdminShell() {
  const context = useContext(AdminShellContext);

  if (!context) {
    return {
      sidebarCollapsed: false,
      toggleSidebar: () => {},
    };
  }

  return context;
}
