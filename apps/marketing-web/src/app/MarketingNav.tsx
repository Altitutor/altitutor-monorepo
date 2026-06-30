"use client";

import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { COURSE_LINKS, NAV_ITEMS, PRODUCT_LINKS } from "@/lib/site";
import { MarketingButton } from "./MarketingUI";
import styles from "./MarketingNav.module.css";

export function MarketingNav() {
  const [isOpen, setIsOpen] = useState(false);
  const [isCoursesOpen, setIsCoursesOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("marketing-menu-open", isOpen);
    return () => document.body.classList.remove("marketing-menu-open");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const media = window.matchMedia("(min-width: 901px)");
    const closeOnDesktop = () => {
      if (media.matches || window.innerWidth >= 901) setIsOpen(false);
    };

    closeOnDesktop();
    media.addEventListener("change", closeOnDesktop);
    window.addEventListener("resize", closeOnDesktop);
    return () => {
      media.removeEventListener("change", closeOnDesktop);
      window.removeEventListener("resize", closeOnDesktop);
    };
  }, [isOpen]);

  const closeMenu = () => {
    setIsOpen(false);
    setIsCoursesOpen(false);
  };
  const closeCourses = () => setIsCoursesOpen(false);
  const mobileMenu = (
    <div className={clsx(styles.mobileMenu, isOpen && styles.mobileMenuOpen)} aria-hidden={!isOpen}>
      <nav aria-label="Mobile primary navigation">
        {NAV_ITEMS.map((item) => (
          <Link href={item.href} key={item.href} onClick={closeMenu}>
            {item.label}
          </Link>
        ))}
      </nav>
      <MarketingButton href={PRODUCT_LINKS.trialBooking} onClick={closeMenu}>
        Free trial
      </MarketingButton>
    </div>
  );

  return (
    <>
      <header className={styles.nav} data-marketing-nav>
        <Link className={styles.brand} href="/" aria-label="Altitutor home" onClick={closeMenu}>
          <Image
            src="/images/marketing/site-logo-large.png"
            alt="Altitutor"
            width={300}
            height={55}
            priority
          />
        </Link>
        <nav className={styles.links} aria-label="Primary navigation">
          {NAV_ITEMS.map((item) =>
            item.href === "/classes/" ? (
              <div
                className={styles.dropdown}
                key={item.href}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    closeCourses();
                  }
                }}
                onFocus={() => setIsCoursesOpen(true)}
                onMouseEnter={() => setIsCoursesOpen(true)}
                onMouseLeave={closeCourses}
              >
                <Link href={item.href} onClick={closeCourses}>
                  {item.label}
                </Link>
                <div className={clsx(styles.menu, isCoursesOpen && styles.menuOpen)}>
                  {COURSE_LINKS.map(([href, label]) => (
                    <Link href={href} key={href} onClick={closeCourses}>
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ),
          )}
        </nav>
        <MarketingButton className={styles.cta} href={PRODUCT_LINKS.trialBooking}>
          Free trial
        </MarketingButton>
        <button
          className={clsx(styles.toggle, isOpen && styles.toggleOpen)}
          type="button"
          aria-label={isOpen ? "Close menu" : "Open menu"}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
        >
          <span />
          <span />
          <span />
        </button>
      </header>
      {mounted ? createPortal(mobileMenu, document.body) : null}
    </>
  );
}
