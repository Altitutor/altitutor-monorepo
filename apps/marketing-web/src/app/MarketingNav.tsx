"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { COURSE_LINKS, NAV_ITEMS, PRODUCT_LINKS } from "@/lib/site";
import { MarketingButton } from "./MarketingUI";

export function MarketingNav() {
  const [isOpen, setIsOpen] = useState(false);
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

  const closeMenu = () => setIsOpen(false);
  const mobileMenu = (
    <div className={`marketing-mobile-menu ${isOpen ? "is-open" : ""}`} aria-hidden={!isOpen}>
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
      <header className="marketing-nav">
        <Link className="marketing-nav__brand" href="/" aria-label="Altitutor home" onClick={closeMenu}>
          <Image
            src="/images/marketing/site-logo-large.png"
            alt="Altitutor"
            width={300}
            height={55}
            priority
          />
        </Link>
        <nav className="marketing-nav__links" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) =>
            item.href === "/classes/" ? (
              <div className="marketing-nav__dropdown" key={item.href}>
                <Link href={item.href}>{item.label}</Link>
                <div className="marketing-nav__menu">
                  {COURSE_LINKS.map(([href, label]) => (
                    <Link href={href} key={href}>
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
        <MarketingButton className="marketing-nav__cta" href={PRODUCT_LINKS.trialBooking}>
          Free trial
        </MarketingButton>
        <button
          className={`marketing-menu-toggle ${isOpen ? "is-open" : ""}`}
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
