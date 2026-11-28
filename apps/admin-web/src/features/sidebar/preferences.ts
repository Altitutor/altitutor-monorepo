import { z } from 'zod';
import { navItems } from '@/shared/constants/adminNavigation';

export function sidebarChildKey(parent: string, child: string) {
  return `${parent}|${child}`;
}

export const sidebarEntries = navItems.flatMap((item) => item.type === 'heading' ? [] : [
  { id: item.href, title: item.title, href: item.href, parent: null },
  ...(item.children ?? []).map((child) => ({
    id: sidebarChildKey(item.href, child.href),
    title: child.title,
    href: child.href,
    parent: item.href,
  })),
]);

const entryIds = new Set(sidebarEntries.map(({ id }) => id));
const ids = z.array(z.string().max(200)).max(100).refine(
  (values) => new Set(values).size === values.length,
);

export const sidebarPreferencesSchema = z.object({ order: ids, hidden: ids }).strict();
export type SidebarPreferences = z.infer<typeof sidebarPreferencesSchema>;
export const defaultSidebarPreferences: SidebarPreferences = { order: [], hidden: [] };

export function normalizeSidebarPreferences(preferences: SidebarPreferences): SidebarPreferences {
  return {
    order: preferences.order.filter((id) => entryIds.has(id)),
    hidden: preferences.hidden.filter((id) => entryIds.has(id)),
  };
}

export function orderSidebarEntries<T>(items: readonly T[], order: readonly string[], key: (item: T) => string) {
  const positions = new Map(order.map((id, index) => [id, index]));
  return [...items].sort((a, b) => (positions.get(key(a)) ?? Infinity) - (positions.get(key(b)) ?? Infinity));
}

export function setSidebarVisibility(preferences: SidebarPreferences, id: string, visible: boolean): SidebarPreferences {
  const hidden = preferences.hidden.filter((entry) => entry !== id);
  return { ...preferences, hidden: visible ? hidden : [...hidden, id] };
}
