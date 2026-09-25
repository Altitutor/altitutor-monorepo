"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  GraduationCap,
  Library,
  ListChecks,
  MessageCircle,
  Monitor,
  NotebookPen,
  Stethoscope,
  ChevronRight,
} from "lucide-react";
import { AnimatedHamburgerIcon } from "@altitutor/ui";
import { IN_PERSON_COURSES, ONLINE_COURSES, PRODUCT_LINKS } from "@/lib/site";
import motion from "./magnetic-button.module.css";
import { SiteLogo } from "./site-logo";
import styles from "../marketing.module.css";

const groups = [
  { href: "/classes/", label: "In person courses", items: IN_PERSON_COURSES },
  { href: "/online-courses/", label: "Online courses", items: ONLINE_COURSES },
] as const;
const links = [
  ["/about/", "About us"],
  ["/about/contact/", "Contact"],
] as const;

const courseDetails = {
  "/classes/weekly-classes/": {
    icon: BookOpen,
    description: "Mathematics, Science, English. SACE and IB. Y1-12.",
  },
  "/classes/examprep/": {
    icon: ListChecks,
    description: "Walk into your exams prepared.",
  },
  "/classes/assignment-drafting/": {
    icon: NotebookPen,
    description: "Turn your ideas into stronger work.",
  },
  "/classes/ucatprep/": {
    icon: Stethoscope,
    description: "Prepare for the UCAT with a tutor.",
  },
  "/classes/medical-interview-preparation/": {
    icon: MessageCircle,
    description: "Practise for your medical interview.",
  },
  "/online-courses/sace-ib-resources/": {
    icon: Library,
    description: "Study notes, resources and practice.",
  },
  "/ucat/": {
    icon: Monitor,
    description: "Your personalised UCAT study plan.",
  },
} as const;

export function Navigation() {
  const pathname = usePathname();
  const [dropdown, setDropdown] = useState<string | null>(null);
  const header = useRef<HTMLElement>(null);
  const [selectedGroup, setSelectedGroup] = useState(0);
  const group = groups[selectedGroup];
  const panel = useRef<HTMLDivElement>(null);
  const previousPanelHeight = useRef<number | null>(null);
  const desktopOpen = dropdown !== null;

  useLayoutEffect(() => {
    const element = panel.current;
    const from = previousPanelHeight.current;
    previousPanelHeight.current = null;
    if (
      !element ||
      from === null ||
      !desktopOpen ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const animation = element.animate(
      [
        { height: `${from}px` },
        { height: `${element.getBoundingClientRect().height}px` },
      ],
      { duration: 360, easing: "cubic-bezier(.22,1,.36,1)" },
    );
    return () => animation.cancel();
  }, [selectedGroup, desktopOpen]);
  function expandGroup(index: number) {
    if (index !== selectedGroup && desktopOpen)
      previousPanelHeight.current =
        panel.current?.getBoundingClientRect().height ?? null;
    setSelectedGroup(index);
    setDropdown(`course-navigation-${index}`);
  }
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
  const [menuClosing, setMenuClosing] = useState(false);
  const menuOpenRef = useRef(false);
  menuOpenRef.current = menuOpen;
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
    const mobile = window.matchMedia("(max-width: 800px)");
    let timer = 0;
    const closeIfDesktop = () => {
      if (mobile.matches || !menuOpenRef.current) return;
      menuOpenRef.current = false;
      setMenuClosing(true);
      requestAnimationFrame(() => {
        setMenuOpen(false);
        window.clearTimeout(timer);
        timer = window.setTimeout(() => setMenuClosing(false), 420);
      });
    };
    mobile.addEventListener("change", closeIfDesktop);
    window.addEventListener("resize", closeIfDesktop);
    return () => {
      mobile.removeEventListener("change", closeIfDesktop);
      window.removeEventListener("resize", closeIfDesktop);
      window.clearTimeout(timer);
    };
  }, []);

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
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !header.current?.contains(event.target)
      )
        closeMenu();
    };
    document.addEventListener("pointerdown", outside);
    return () => {
      document.body.style.overflow = previousOverflow;
      siblings.forEach((node, index) => {
        node.inert = previousInert[index];
      });
      document.removeEventListener("pointerdown", outside);
    };
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
    trigger.current?.focus();
  }

  const logoVariant =
    pathname === "/" &&
    !scrolled &&
    !menuOpen &&
    !menuClosing &&
    !dropdown
      ? "dark"
      : "light";

  return (
    <>
      <a href="#main-content" className={styles.skipLink}>
        Skip to content
      </a>
      {menuOpen || menuClosing ? (
        <div className={styles.menuBackdrop} data-open={menuOpen} />
      ) : null}
      <header
        ref={header}
        onPointerLeave={(event) => {
          if (event.pointerType !== "mouse") return;
          if (
            !header.current
              ?.querySelector("[data-desktop-panel]")
              ?.contains(document.activeElement)
          )
            setDropdown(null);
        }}
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
              ?.querySelector<HTMLAnchorElement>(
                `[data-course-trigger="${dropdown}"]`,
              )
              ?.focus();
            setDropdown(null);
          }
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            setDropdown(null);
        }}
        className={`${styles.navigation} ${scrolled ? styles.navigationScrolled : pathname === "/" ? styles.navigationOverHero : ""} ${menuOpen || menuClosing || dropdown ? styles.navigationExpanded : ""}`}
        data-menu-closing={menuClosing || undefined}
      >
        <div className={styles.navigationRow}>
          <Link href="/" className={styles.brand} aria-label="Altitutor home">
            <SiteLogo
              variant={logoVariant}
              className={styles.brandLogo}
              priority
            />
          </Link>
          <nav className={styles.desktopLinks} aria-label="Primary navigation">
            {groups.map(({ href, label }, index) => {
              const id = `course-navigation-${index}`;
              return (
                <button
                  key={href}
                  type="button"
                  aria-expanded={dropdown === id}
                  aria-controls="desktop-course-navigation"
                  data-course-trigger={id}
                  className={styles.courseTrigger}
                  onPointerEnter={(event) => {
                    if (event.pointerType === "mouse") expandGroup(index);
                  }}
                  onFocus={() => expandGroup(index)}
                  onClick={() => {
                    if (dropdown !== id) expandGroup(index);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      expandGroup(index);
                      requestAnimationFrame(() =>
                        header.current
                          ?.querySelector<HTMLElement>(
                            "#desktop-course-navigation a",
                          )
                          ?.focus(),
                      );
                    }
                  }}
                >
                  {label}
                  <ChevronRight
                    size={14}
                    className={styles.courseChevron}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
            {links.map(([href, label]) => (
              <Link
                href={href}
                key={href}
                onPointerEnter={() => setDropdown(null)}
                onFocus={() => setDropdown(null)}
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
              <span aria-hidden="true">
                <AnimatedHamburgerIcon isOpen={menuOpen} />
              </span>
            </button>
          </div>
        </div>
        <div
          className={styles.desktopExpansion}
          data-open={Boolean(dropdown)}
          data-desktop-panel
          ref={(node) => {
            if (node) node.inert = !dropdown;
          }}
        >
          <div className={styles.desktopPanelClip} ref={panel}>
            <nav
              key={group.href}
              id="desktop-course-navigation"
              aria-label={group.label}
              className={styles.courseCards}
            >
              {group.items.map(([href, title]) => {
                const { icon: Icon, description } = courseDetails[href];
                return (
                  <Link
                    key={href}
                    href={href}
                    className={styles.courseMenuCard}
                    onClick={() => setDropdown(null)}
                  >
                    <Icon size={24} aria-hidden="true" />
                    <span className={styles.courseCardTitle}>{title}</span>
                    <span className={styles.courseCardDescription}>
                      {description}
                    </span>
                    <ArrowUpRight
                      className={styles.courseCardArrow}
                      size={17}
                      aria-hidden="true"
                    />
                  </Link>
                );
              })}
              <Link
                href={group.href}
                className={`${styles.courseMenuCard} ${styles.allCoursesCard}`}
                onClick={() => setDropdown(null)}
              >
                <GraduationCap size={24} aria-hidden="true" />
                <span className={styles.courseCardTitle}>
                  All {group.label.toLowerCase()}
                </span>
                <span className={styles.courseCardDescription}>
                  {selectedGroup === 0
                    ? "Find your next step in Adelaide."
                    : "Find your way to learn online."}
                </span>
                <ArrowUpRight
                  className={styles.courseCardArrow}
                  size={17}
                  aria-hidden="true"
                />
              </Link>
            </nav>
          </div>
        </div>
        <div
          className={styles.mobileExpansion}
          data-open={menuOpen}
          data-closing={menuClosing || undefined}
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
