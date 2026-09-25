"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { PRODUCT_LINKS } from "@/lib/site";
import styles from "../marketing.module.css";

const links = [
  ["/classes/", "Courses"],
  ["/resources/", "Resources"],
  ["/about/", "About us"],
  ["/about/contact/", "Contact"],
  ["/ucat/", "UCAT online"],
] as const;

export function Navigation() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const closing = useRef(false);
  const menuAnimation = useRef<Animation | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 72);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const desktop = window.matchMedia("(min-width: 801px)");
    const onResize = () => {
      if (desktop.matches) dialog.current?.close();
    };
    desktop.addEventListener("change", onResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      desktop.removeEventListener("change", onResize);
      menuAnimation.current?.cancel();
    };
  }, [menuOpen]);

  function openMenu() {
    if (!dialog.current || dialog.current.open) return;
    dialog.current.showModal();
    setMenuOpen(true);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    menuAnimation.current = dialog.current.animate(
      [
        { clipPath: "inset(0 0 calc(100% - 60px) 0 round 30px)" },
        { clipPath: "inset(0 0 0 0 round 30px)" },
      ],
      { duration: 520, easing: "cubic-bezier(.22,1,.36,1)" },
    );
  }

  async function closeMenu() {
    if (closing.current || !dialog.current?.open) return;
    closing.current = true;
    menuAnimation.current?.cancel();
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      menuAnimation.current = dialog.current.animate(
        [
          { clipPath: "inset(0 0 0 0 round 30px)" },
          { clipPath: "inset(0 0 calc(100% - 60px) 0 round 30px)" },
        ],
        { duration: 240, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" },
      );
      await menuAnimation.current.finished.catch(() => undefined);
    }
    dialog.current?.close();
    closing.current = false;
    requestAnimationFrame(() => trigger.current?.focus());
  }

  return (
    <>
      <a href="#main-content" className={styles.skipLink}>
        Skip to content
      </a>
      <header
        className={`${styles.navigation} ${scrolled ? styles.navigationScrolled : pathname === "/" ? styles.navigationOverHero : ""} ${menuOpen ? styles.navigationHidden : ""}`}
      >
        <Link href="/" className={styles.brand} aria-label="Altitutor home">
          alti<span>tutor</span>
          <i aria-hidden="true">.</i>
        </Link>
        <nav className={styles.desktopLinks} aria-label="Primary navigation">
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
          <Link className={styles.navTrial} href={PRODUCT_LINKS.trialBooking}>
            Free trial <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
          <button
            className={styles.menuButton}
            aria-label="Open navigation"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={openMenu}
            ref={trigger}
          >
            <Menu size={22} />
          </button>
        </div>
      </header>
      <dialog
        id="mobile-navigation"
        className={styles.mobileMenu}
        onCancel={(event) => {
          event.preventDefault();
          void closeMenu();
        }}
        onClose={() => {
          setMenuOpen(false);
          menuAnimation.current?.cancel();
        }}
        ref={dialog}
        aria-label="Site navigation"
        onClick={(event) => {
          if (event.target === event.currentTarget) closeMenu();
        }}
      >
        <div className={styles.mobileMenuTop}>
          <Link href="/" className={styles.brand} onClick={closeMenu}>
            alti<span>tutor</span>
            <i aria-hidden="true">.</i>
          </Link>
          <button aria-label="Close navigation" onClick={closeMenu}>
            <X />
          </button>
        </div>
        <nav aria-label="Mobile navigation">
          {[["/", "Home"], ...links].map(([href, label]) => (
            <Link href={href} key={href} onClick={closeMenu}>
              {label}
              <ArrowUpRight size={20} />
            </Link>
          ))}
        </nav>
        <Link
          className={styles.button}
          href={PRODUCT_LINKS.trialBooking}
          onClick={closeMenu}
        >
          Book a free trial <ArrowUpRight size={18} />
        </Link>
        <Link
          className={styles.mobileLogin}
          href={PRODUCT_LINKS.studentLogin}
          onClick={closeMenu}
        >
          Student sign in
        </Link>
      </dialog>
    </>
  );
}
