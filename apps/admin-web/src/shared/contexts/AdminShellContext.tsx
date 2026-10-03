'use client';

import React, { createContext, useContext, useMemo, useState } from 'react';

type AdminShellContextValue = {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  collapsedGroups: string[];
  toggleGroup: (title: string) => void;
};

const AdminShellContext = createContext<AdminShellContextValue | null>(null);

export function AdminShellProvider({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);

  const value = useMemo(
    () => ({
      sidebarCollapsed,
      collapsedGroups,
      toggleGroup: (title: string) => setCollapsedGroups(groups => groups.includes(title) ? groups.filter(group => group !== title) : [...groups, title]),
      toggleSidebar: () => setSidebarCollapsed((collapsed) => !collapsed),
    }),
    [sidebarCollapsed, collapsedGroups],
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
      collapsedGroups: [],
      toggleGroup: (_title: string) => {},
      toggleSidebar: () => {},
    };
  }

  return context;
}
