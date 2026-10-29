import type { ReactNode } from 'react';

export function SettingsPageHeader({
  title,
  actions,
}: {
  title: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex min-w-0 items-center justify-between gap-4">
      <h1 className="truncate text-3xl font-bold tracking-tight">{title}</h1>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
