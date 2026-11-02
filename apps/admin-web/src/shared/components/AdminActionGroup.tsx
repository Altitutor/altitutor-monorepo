import type { ReactNode } from "react";
export function AdminActionGroup({ label, children }: { label: string; children: ReactNode }) {
  return <div role="group" aria-label={label} className="admin-action-group">{children}</div>;
}
