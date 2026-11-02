import type { ReactNode } from 'react';
import { AdminPageActions } from './AdminPageActions';

export function SettingsPageHeader({ actions }: { title: string; actions?: ReactNode }) {
  return <AdminPageActions>{actions}</AdminPageActions>;
}
