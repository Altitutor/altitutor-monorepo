import type { LucideIcon } from 'lucide-react';
import { settingsSections } from '@/shared/constants/adminSettings';

export type SettingsNavItem = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

export type SettingsNavSection = {
  title: string;
  items: SettingsNavItem[];
};

export { settingsSections };

export const settingsBackHref = '/dashboard';

export const firstSettingsHref = settingsSections[0]?.items[0]?.href ?? settingsBackHref;

export function filterSettingsSections(
  sections: SettingsNavSection[],
  query: string,
): SettingsNavSection[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return sections;
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const haystack = `${item.title} ${item.description}`.toLowerCase();
        return haystack.includes(needle);
      }),
    }))
    .filter((section) => section.items.length > 0);
}

export function isSettingsRoute(pathname: string): boolean {
  return pathname === '/settings' || pathname.startsWith('/settings/');
}
