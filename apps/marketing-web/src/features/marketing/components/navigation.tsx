"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, Menu, X } from "lucide-react";
import { IN_PERSON_COURSES, ONLINE_COURSES, PRODUCT_LINKS } from "@/lib/site";
import motion from "./magnetic-button.module.css";
import styles from "../marketing.module.css";

const groups = [
  { href: "/classes/", label: "In person courses", items: IN_PERSON_COURSES },
  { href: "/online-courses/", label: "Online courses", items: ONLINE_COURSES },
] as const;
const links = [
  ["/about/", "About us"],
  ["/about/contact/", "Contact"],
] as const;

export function Navigation() {
  const pathname = usePathname();
  const [dropdown, setDropdown] = useState<string | null>(null);
  const header = useRef<HTMLElement>(null);
  useEffect(() => {
    setDropdown(null);
  }, [pathname]);
  useEffect(() => {
    if (!dropdown) return;
    const dismiss = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !header.current?.contains(event.target)
      )
        setDropdown(null);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [dropdown]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 72);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const siblings = Array.from(
      header.current?.parentElement?.children ?? [],
    ).filter(
      (node): node is HTMLElement =>
        node instanceof HTMLElement &&
        node !== header.current &&
        node.tagName !== "A",
    );
    const previousInert = siblings.map((node) => node.inert);
    siblings.forEach((node) => {
      node.inert = true;
    });
    const desktop = window.matchMedia("(min-width: 801px)");
    const dismiss = () => {
      if (desktop.matches) setMenuOpen(false);
    };
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !header.current?.contains(event.target)
      )
        closeMenu();
    };
    desktop.addEventListener("change", dismiss);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.body.style.overflow = previousOverflow;
      siblings.forEach((node, index) => {
        node.inert = previousInert[index];
      });
      desktop.removeEventListener("change", dismiss);
      document.removeEventListener("pointerdown", outside);
    };
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
    trigger.current?.focus();
  }

  return (
    <>
      <a href="#main-content" className={styles.skipLink}>
        Skip to content
      </a>
      <header
        ref={header}
        onKeyDown={(event) => {
          if (menuOpen && event.key === "Escape") closeMenu();
          if (menuOpen && event.key === "Tab") {
            const targets = Array.from(
              header.current?.querySelectorAll<HTMLElement>(
                "a[href], button",
              ) ?? [],
            ).filter(
              (node) =>
                node.getClientRects().length && !node.closest("[inert]"),
            );
            const first = targets[0];
            const last = targets[targets.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            }
            if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
          if (event.key === "Escape" && dropdown) {
            header.current
              ?.querySelector<HTMLButtonElement>(
                `[aria-controls="${dropdown}"]`,
              )
              ?.focus();
            setDropdown(null);
          }
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            setDropdown(null);
        }}
        className={`${styles.navigation} ${scrolled ? styles.navigationScrolled : pathname === "/" ? styles.navigationOverHero : ""} ${menuOpen ? styles.navigationExpanded : ""}`}
      >
        <div className={styles.navigationRow}>
          <Link href="/" className={styles.brand} aria-label="Altitutor home">
            alti<span>tutor</span>
            <i aria-hidden="true">.</i>
          </Link>
          <nav className={styles.desktopLinks} aria-label="Primary navigation">
            {groups.map(({ href, label, items }, index) => {
              const id = `course-navigation-${index}`;
              return (
                <div className={styles.navGroup} key={href}>
                  <Link
                    href={href}
                    aria-current={pathname === href ? "page" : undefined}
                  >
                    {label}
                  </Link>
                  <button
                    className={styles.navDisclosure}
                    aria-label={`Show ${label.toLowerCase()}`}
                    aria-expanded={dropdown === id}
                    aria-controls={id}
                    onClick={() => setDropdown(dropdown === id ? null : id)}
                  >
                    <ChevronDown size={14} aria-hidden="true" />
                  </button>
                  {dropdown === id ? (
                    <div id={id} className={styles.navDropdown}>
                      {items.map(([childHref, childLabel]) => (
                        <Link
                          key={childHref}
                          href={childHref}
                          onClick={() => setDropdown(null)}
                        >
                          {childLabel}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {links.map(([href, label]) => (
              <Link
                href={href}
                key={href}
                aria-current={pathname === href ? "page" : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className={styles.navActions}>
            <Link
              className={`${styles.navTrial} ${motion.magnetic}`}
              href={PRODUCT_LINKS.trialBooking}
            >
              <span className={motion.fill} aria-hidden="true" />
              Free trial <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
            <button
              className={styles.menuButton}
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMenuOpen(!menuOpen)}
              ref={trigger}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
        <div
          className={styles.mobileExpansion}
          data-open={menuOpen}
          ref={(node) => {
            if (node) node.inert = !menuOpen;
          }}
        >
          <div className={styles.mobileMenu} id="mobile-navigation">
            <nav aria-label="Mobile navigation">
              {groups.map(({ href, label, items }) => (
                <div className={styles.mobileCourseGroup} key={href}>
                  <Link href={href} onClick={closeMenu}>
                    {label}
                    <ArrowUpRight size={20} aria-hidden="true" />
                  </Link>
                  <div className={styles.mobileCourseChildren}>
                    {items.map(([childHref, childLabel]) => (
                      <Link
                        href={childHref}
                        key={childHref}
                        onClick={closeMenu}
                      >
                        {childLabel}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              {links.map(([href, label]) => (
                <Link href={href} key={href} onClick={closeMenu}>
                  {label}
                  <ArrowUpRight size={20} />
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>
    </>
  );
}
