"use client";

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { recentPageHref, recordRecentPage } from './history';

export function useRecordRecentPage(staffId: string | undefined, pathname: string, title: string | undefined) {
  const search = useSearchParams();
  const href = recentPageHref(pathname, new URLSearchParams(search.toString()));
  const lastVisit = useRef<{ staffId: string; href: string } | null>(null);

  useEffect(() => {
    if (!staffId || !href || !title?.trim()) return;
    const promote = lastVisit.current?.staffId !== staffId || lastVisit.current.href !== href;
    recordRecentPage(staffId, { href, title: title.trim() }, promote);
    lastVisit.current = { staffId, href };
  }, [staffId, href, title]);
}
