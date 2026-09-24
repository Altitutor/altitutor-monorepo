"use client";

import { MARKETING_TOKENS } from "@altitutor/shared";
import { ArrowRight, Facebook, Instagram, Mail, Youtube } from "lucide-react";
import Link from "next/link";
import { AnalyticsLink } from "../analytics-link";
import { PRODUCT_LINKS } from "@/lib/site";
import { MagneticButton } from "./magnetic-button";
import {
  UCAT_DARK_BODY_DESCRIPTION_CLASS,
  UCAT_DARK_SUPPORTING_TEXT_CLASS,
  UCAT_SECTION_HEADING_DARK_CLASS,
} from "./ucat-landing-section-eyebrow";

const { typography: typo } = MARKETING_TOKENS;

export function UcatLandingFooter() {
  return (
    <footer className="relative overflow-hidden rounded-t-[3rem] bg-marketing-charcoal px-4 pb-14 pt-24 text-marketing-cream sm:px-8 sm:pt-32">
      <div className="absolute bottom-0 left-1/2 h-[420px] w-[760px] -translate-x-1/2 translate-y-2/3 rounded-full bg-marketing-primary/55 blur-[120px]" />
      <div className="relative mx-auto max-w-7xl">
        <div className="border-b border-white/10 pb-20 text-center">
          <p
            className={`text-xs font-semibold uppercase tracking-[0.18em] text-marketing-accent ${typo.dataMono}`}
          >
            Start with a useful baseline
          </p>
          <h2
            className={`mx-auto mt-4 max-w-3xl ${UCAT_SECTION_HEADING_DARK_CLASS} ${typo.headingSans}`}
          >
            See where you stand, then take the next step.
          </h2>
          <p
            className={`mx-auto mt-5 max-w-xl ${UCAT_DARK_BODY_DESCRIPTION_CLASS} ${typo.secondarySans}`}
          >
            Start preparing now and keep practicing for free.
          </p>
          <AnalyticsLink
            href={PRODUCT_LINKS.ucatSignup}
            analytics={{
              product: "ucat",
              placement: "footer_cta",
              action: "start_free",
            }}
            className="mt-8 inline-block"
          >
            <MagneticButton className="bg-marketing-accent px-7 py-3.5 text-base font-semibold text-marketing-charcoal">
              Start preparing free{" "}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </MagneticButton>
          </AnalyticsLink>
        </div>

        <div className="grid gap-12 border-b border-white/10 py-14 md:grid-cols-4">
          <div className="md:col-span-2">
            <h2
              className={`text-2xl font-bold tracking-tight ${typo.headingSans}`}
            >
              Altitutor UCAT
            </h2>
            <p
              className={`mt-4 max-w-md ${UCAT_DARK_SUPPORTING_TEXT_CLASS} ${typo.secondarySans}`}
            >
              A not-for-profit initiative by Altitutor.
            </p>
            <a
              href="mailto:admin@altitutor.com"
              className={`mt-5 inline-flex items-center gap-2 text-sm text-marketing-accent hover:underline ${typo.secondarySans}`}
            >
              <Mail className="h-4 w-4" aria-hidden /> admin@altitutor.com
            </a>
          </div>

          <div>
            <h3
              className={`text-xs font-semibold uppercase tracking-[0.15em] text-marketing-accent ${typo.dataMono}`}
            >
              Altitutor UCAT
            </h3>
            <ul
              className={`mt-5 space-y-3 ${UCAT_DARK_SUPPORTING_TEXT_CLASS} ${typo.secondarySans}`}
            >
              <li>
                <a href="#how-it-works" className="hover:text-marketing-cream">
                  How it works
                </a>
              </li>
              <li>
                <a href="#mission" className="hover:text-marketing-cream">
                  Our mission
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-marketing-cream">
                  Pricing
                </a>
              </li>
              <li>
                <AnalyticsLink
                  href={PRODUCT_LINKS.ucatLogin}
                  analytics={{
                    product: "ucat",
                    placement: "footer",
                    action: "login",
                  }}
                  className="hover:text-marketing-cream"
                >
                  Sign in
                </AnalyticsLink>
              </li>
            </ul>
          </div>

          <div>
            <h3
              className={`text-xs font-semibold uppercase tracking-[0.15em] text-marketing-accent ${typo.dataMono}`}
            >
              Altitutor
            </h3>
            <ul
              className={`mt-5 space-y-3 ${UCAT_DARK_SUPPORTING_TEXT_CLASS} ${typo.secondarySans}`}
            >
              <li>
                <Link href="/about/" className="hover:text-marketing-cream">
                  About us
                </Link>
              </li>
              <li>
                <Link href="/about/subsidy/" className="hover:text-marketing-cream">
                  Tuition subsidy
                </Link>
              </li>
              <li>
                <Link href="/classes/ucatprep/" className="hover:text-marketing-cream">
                  Adelaide UCAT classes
                </Link>
              </li>
              <li>
                <Link href="/about/contact/" className="hover:text-marketing-cream">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-6 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className={`text-xs text-marketing-cream/35 ${typo.secondarySans}`}>
            &copy; {new Date().getFullYear()} Altitutor. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://www.instagram.com/altitutor/"
              aria-label="Altitutor on Instagram"
              target="_blank"
              rel="noreferrer"
              className="text-marketing-cream/45 transition-colors hover:text-marketing-accent"
            >
              <Instagram className="h-5 w-5" />
            </a>
            <a
              href="https://www.tiktok.com/@altitutor"
              aria-label="Altitutor on TikTok"
              target="_blank"
              rel="noreferrer"
              className="text-marketing-cream/45 transition-colors hover:text-marketing-accent"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden
                className="h-5 w-5 fill-current"
              >
                <path d="M16.7 3c.4 2.5 1.8 4 4.3 4.2v3.6a7.7 7.7 0 0 1-4.2-1.3v6.1A5.4 5.4 0 1 1 11.4 10h.8v3.8a2 2 0 1 0 1.2 1.8V3h3.3Z" />
              </svg>
            </a>
            <a
              href="https://www.facebook.com/altitutoreducation/"
              aria-label="Altitutor on Facebook"
              target="_blank"
              rel="noreferrer"
              className="text-marketing-cream/45 transition-colors hover:text-marketing-accent"
            >
              <Facebook className="h-5 w-5" />
            </a>
            <a
              href="https://www.youtube.com/@altitutor"
              aria-label="Altitutor on YouTube"
              target="_blank"
              rel="noreferrer"
              className="text-marketing-cream/45 transition-colors hover:text-marketing-accent"
            >
              <Youtube className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
