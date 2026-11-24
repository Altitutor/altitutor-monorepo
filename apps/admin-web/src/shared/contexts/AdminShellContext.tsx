'use client';

import React, { createContext, useContext, useMemo, useState } from 'react';

export const adminSidebarWidth = { expanded: 250, collapsed: 70 };

type AdminShellContextValue = {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  collapseSidebar: () => void;
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
      collapseSidebar: () => setSidebarCollapsed(true),
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
      collapseSidebar: () => {},
    };
  }

  return context;
}
