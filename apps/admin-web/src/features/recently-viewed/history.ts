import { paneHref } from '@/shared/components/pane-workspace/pane-routing';

const changeEvent = 'admin-recently-viewed';
const maxEntries = 20;

type RecentPage = { href: string; title: string };

function storageKey(staffId: string) {
  return `admin:recently-viewed:${staffId}`;
}

export function readRecentPages(staffId: string) {
  try {
    return window.localStorage.getItem(storageKey(staffId)) ?? '';
  } catch {
    return '';
  }
}

export function parseRecentPages(snapshot: string): RecentPage[] {
  try {
    const pages: unknown = JSON.parse(snapshot);
    if (!Array.isArray(pages)) return [];
    return pages.filter((page): page is RecentPage =>
      typeof page?.href === 'string' && paneHref(page.href) === page.href &&
      typeof page.title === 'string' && page.title.trim().length > 0,
    ).slice(0, maxEntries);
  } catch {
    return [];
  }
}

export function subscribeToRecentPages(onChange: () => void) {
  window.addEventListener(changeEvent, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(changeEvent, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function recentPageHref(pathname: string, search: URLSearchParams) {
  const params = new URLSearchParams();
  // Retain selections that identify a view or conversation without saving free-text searches.
  const keys = pathname === '/messages' ? ['view', 'contact', 'group', 'conversation'] : ['view'];
  for (const key of keys) {
    const value = search.get(key);
    if (value) params.set(key, value);
  }
  return paneHref(params.size ? `${pathname}?${params}` : pathname);
}

export function recordRecentPage(staffId: string, page: RecentPage, promote: boolean) {
  const snapshot = readRecentPages(staffId);
  const pages = parseRecentPages(snapshot);
  const index = pages.findIndex(({ href }) => href === page.href);
  if (promote) {
    if (index >= 0) pages.splice(index, 1);
    pages.unshift(page);
  } else if (index >= 0) {
    pages[index] = page;
  } else {
    return;
  }

  const next = JSON.stringify(pages.slice(0, maxEntries));
  if (next === snapshot) return;
  try {
    window.localStorage.setItem(storageKey(staffId), next);
    window.dispatchEvent(new Event(changeEvent));
  } catch {
    // A restricted browser can still navigate with the rest of the toolbar.
  }
}
