"use client";

import { useEffect, useRef } from 'react';
import { paneHref } from '@/shared/components/pane-workspace/pane-routing';
import { recordRecentPage } from './history';

function recentDestination(href: string, content: Element, fallbackTitle: string) {
  const url = new URL(href, window.location.origin);
  const pageTitle = content.querySelector<HTMLElement>('[data-admin-page-header] [data-pane-title]')?.dataset.paneTitle;
  const inlineThread = url.pathname === '/email' ? url.searchParams.get('conversation') : null;
  if (inlineThread) {
    url.pathname = `/email/${encodeURIComponent(inlineThread)}`;
    url.searchParams.delete('conversation');
  }
  const path = url.pathname.replace(/\/$/, '') || '/';
  const conversation = path === '/messages'
    ? ['contact', 'group', 'conversation'].map((key) => url.searchParams.get(key)).find(Boolean)
    : null;
  const record = path.split('/').some((part) => /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(part))
    || Boolean(inlineThread || conversation);
  // Mail's saved-view settings are held in its component state.
  const view = record || path === '/email' ? null : content.querySelector<HTMLElement>('[data-saved-view-id][aria-pressed="true"]');
  const viewName = view?.dataset.savedViewName;
  const inlineSubject = content.querySelector<HTMLElement>('[data-recent-email-subject]')?.dataset.recentEmailSubject;
  const title = (inlineThread ? inlineSubject : pageTitle?.trim()) || fallbackTitle;

  // A record can render asynchronously. Wait for a useful label in its own pane.
  if (inlineThread && !inlineSubject) return null;
  if (record && ((!pageTitle && !inlineThread) || title === 'Messages' || title === 'Loading topic…' || /^[\da-f]{8}\.\.\.$/i.test(title))) return null;

  // Preserve destination and saved-view settings, leaving ad hoc search text out of history.
  url.searchParams.delete('search');
  url.searchParams.delete('page');
  const recentHref = paneHref(url.pathname + url.search + url.hash);
  if (!recentHref) return null;

  return {
    key: JSON.stringify([path, conversation, view?.dataset.savedViewId ?? null]),
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
    let timer: number | undefined;

    const observe = () => {
      observer?.disconnect();
      window.clearTimeout(timer);
      const doc = frame ? frame.contentDocument : document;
      const root = frame ? doc?.documentElement : pane;
      if (!doc || !root) return;

      let pending: ReturnType<typeof recentDestination> = null;
      const inspect = () => {
        const location = doc.location;
        const content = root.querySelector('[data-admin-main]');
        const page = location && content && paneHref(location.pathname + location.search) === href
          ? recentDestination(href, content, fallbackTitle)
          : null;
        if (page?.key === pending?.key && page?.href === pending?.href && page?.title === pending?.title) return;

        window.clearTimeout(timer);
        pending = page;
        if (!page) return;

        // The toolbar selection and pane URL can update in different renders.
        timer = window.setTimeout(() => {
          const promote = visit.current?.staffId !== staffId || visit.current.key !== page.key;
          recordRecentPage(staffId, page, promote);
          visit.current = { staffId, key: page.key };
        }, 200);
      };

      inspect();
      observer = new MutationObserver(inspect);
      observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-pressed', 'data-pane-title', 'data-recent-email-subject'] });
    };

    observe();
    frame?.addEventListener('load', observe);
    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
      frame?.removeEventListener('load', observe);
    };
  }, [staffId, activePane, href, fallbackTitle]);
}
