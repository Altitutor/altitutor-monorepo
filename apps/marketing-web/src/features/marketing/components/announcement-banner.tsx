"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import styles from "./announcement-banner.module.css";

// Change the campaign/version when a materially new announcement should appear.
const dismissalKey = "altitutor:announcement:medicine-interviews-2026-open:v1";

export function AnnouncementBanner() {
  const [dismissed, setDismissed] = useState(false);
  const banner = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      setDismissed(window.sessionStorage.getItem(dismissalKey) === "dismissed");
    } catch {
      // The banner still works if the browser blocks session storage.
    }
  }, []);

  useEffect(() => {
    const element = banner.current;
    const site = element?.parentElement;
    if (!element || !site) return;
    const updateHeight = () => {
      site.style.setProperty(
        "--announcement-height",
        `${element.getBoundingClientRect().height}px`,
      );
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    return () => {
      observer.disconnect();
      site.style.removeProperty("--announcement-height");
    };
  }, [dismissed]);

  function dismiss() {
    try {
      window.sessionStorage.setItem(dismissalKey, "dismissed");
    } catch {
      // Dismiss for this page even when persistence is unavailable.
    }
    // Keep keyboard focus useful after the close button is removed.
    banner.current?.parentElement
      ?.querySelector<HTMLElement>("header a")
      ?.focus({ preventScroll: true });
    setDismissed(true);
  }

  if (dismissed) return null;

  return (
    <aside
      ref={banner}
      className={styles.banner}
      data-announcement-banner
      aria-label="Medicine interview course announcement"
    >
      <div className={styles.content}>
        <Link
          href="/classes/medical-interview-preparation/"
          className={styles.message}
          aria-label="Medicine interview course — sign-ups open now. View course"
        >
          <span className={styles.desktopMessage}>
            Medicine interview course — sign-ups open now
          </span>
          <span className={styles.mobileMessage}>
            Medicine interviews: sign-ups open
            <ArrowRight size={15} aria-hidden="true" />
          </span>
          <span className={styles.action}>
            View course <ArrowRight size={15} aria-hidden="true" />
          </span>
        </Link>
        <button
          type="button"
          className={styles.close}
          aria-label="Dismiss medicine interview announcement"
          onClick={dismiss}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
