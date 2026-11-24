"use client";

import { useEffect, useRef } from 'react';
import { paneHref } from '@/shared/components/pane-workspace/pane-routing';
import { recordRecentPage } from './history';

function recentDestination(href: string, content: Element, fallbackTitle: string) {
  const url = new URL(href, window.location.origin);
  const lastCrumb = content.querySelector('[data-recent-page-title]');
  const path = url.pathname.replace(/\/$/, '') || '/';
  const emailMessage = path === '/email' ? url.searchParams.get('message') : null;
  const conversation = path === '/messages'
    ? ['contact', 'group', 'conversation'].map((key) => url.searchParams.get(key)).find(Boolean)
    : null;
  const record = path.split('/').some((part) => /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(part))
    || emailMessage || conversation;
  const view = record ? null : content.querySelector<HTMLElement>('[data-saved-view-id][aria-pressed="true"]');
  const viewName = view?.dataset.savedViewName;
  const title = lastCrumb?.textContent?.trim() || fallbackTitle;

  // A record can render asynchronously. Wait for a useful label in its own pane.
  if (record && (!lastCrumb || title === 'Messages' || /^(Loading\b|[\da-f]{8}\.\.\.$)/i.test(title))) return null;

  // Preserve destination and saved-view settings, leaving ad hoc search text out of history.
  url.searchParams.delete('search');
  url.searchParams.delete('page');
  const recentHref = paneHref(url.pathname + url.search + url.hash);
  if (!recentHref) return null;

  return {
    key: JSON.stringify([path, emailMessage, conversation, view?.dataset.savedViewId ?? null]),
    href: recentHref,
    title: viewName && viewName !== title ? `${title} · ${viewName}` : title,
  };
}

export function useRecordRecentPage(staffId: string | undefined, activePane: string, href: string, fallbackTitle: string) {
  const visit = useRef<{ staffId: string; key: string } | null>(null);

  useEffect(() => {
    if (!staffId) return;
    const pane = document.getElementById(`workspace-pane-${activePane}`);
    const frame = pane?.querySelector<HTMLIFrameElement>('iframe[data-admin-pane-frame]');
    let observer: MutationObserver | undefined;

    const observe = () => {
      observer?.disconnect();
      const doc = frame ? frame.contentDocument : document;
      const content = frame ? doc?.querySelector('[data-admin-main]') : pane?.querySelector('[data-admin-main]');
      if (!doc || !content) return;

      let lastPage: ReturnType<typeof recentDestination> = null;
      const record = () => {
        const location = doc.location;
        if (!location || paneHref(location.pathname + location.search) !== href) return;
        const page = recentDestination(href, content, fallbackTitle);
        if (!page || (lastPage?.key === page.key && lastPage.href === page.href && lastPage.title === page.title)) return;
        lastPage = page;
        const promote = visit.current?.staffId !== staffId || visit.current.key !== page.key;
        recordRecentPage(staffId, page, promote);
        visit.current = { staffId, key: page.key };
      };

      record();
      observer = new MutationObserver(record);
      observer.observe(content, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-pressed'] });
    };

    observe();
    frame?.addEventListener('load', observe);
    return () => {
      observer?.disconnect();
      frame?.removeEventListener('load', observe);
    };
  }, [staffId, activePane, href, fallbackTitle]);
}
