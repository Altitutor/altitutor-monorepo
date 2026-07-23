"use client";

import { MARKETING_TOKENS } from "@altitutor/shared";
import { ArrowRight, Facebook, Instagram, Mail, Youtube } from "lucide-react";
import Link from "next/link";
import { AnalyticsLink } from "../analytics-link";
import { PRODUCT_LINKS } from "@/lib/site";
import { MagneticButton } from "./magnetic-button";

const { typography: typo } = MARKETING_TOKENS;

export function UcatLandingFooter() {
  return (
    <footer className="relative overflow-hidden rounded-t-[3rem] bg-marketing-charcoal px-4 pb-12 pt-20 text-marketing-cream sm:px-8 sm:pt-28">
      <div className="absolute bottom-0 left-1/2 h-[420px] w-[760px] -translate-x-1/2 translate-y-2/3 rounded-full bg-marketing-primary/55 blur-[120px]" />
      <div className="relative mx-auto max-w-7xl">
        <div className="border-b border-white/10 pb-20 text-center">
          <p
            className={`text-xs font-semibold uppercase tracking-[0.18em] text-marketing-accent ${typo.dataMono}`}
          >
            Start with a useful baseline
          </p>
          <h2
            className={`mx-auto mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.035em] sm:text-5xl ${typo.headingSans}`}
          >
            See where you stand, then take the next step.
          </h2>
          <p
            className={`mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/60 ${typo.secondarySans}`}
          >
            Start preparing now and keep practising for free.
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
              className={`mt-4 max-w-md text-sm leading-relaxed text-white/55 ${typo.secondarySans}`}
            >
              UCAT preparation that helps you understand where you stand and
              what to do next. A not-for-profit initiative by Altitutor.
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
              className={`mt-5 space-y-3 text-sm text-white/65 ${typo.secondarySans}`}
            >
              <li>
                <a href="#how-it-works" className="hover:text-white">
                  How it works
                </a>
              </li>
              <li>
                <a href="#free-forever" className="hover:text-white">
                  Free forever
                </a>
              </li>
              <li>
                <a href="#mission" className="hover:text-white">
                  Our mission
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-white">
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
                  className="hover:text-white"
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
              className={`mt-5 space-y-3 text-sm text-white/65 ${typo.secondarySans}`}
            >
              <li>
                <Link href="/about/" className="hover:text-white">
                  About us
                </Link>
              </li>
              <li>
                <Link href="/about/subsidy/" className="hover:text-white">
                  Tuition subsidy
                </Link>
              </li>
              <li>
                <Link href="/classes/ucatprep/" className="hover:text-white">
                  Adelaide UCAT classes
                </Link>
              </li>
              <li>
                <Link href="/about/contact/" className="hover:text-white">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-6 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className={`text-xs text-white/35 ${typo.secondarySans}`}>
            &copy; {new Date().getFullYear()} Altitutor. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://www.instagram.com/altitutor/"
              aria-label="Altitutor on Instagram"
              target="_blank"
              rel="noreferrer"
              className="text-white/45 transition-colors hover:text-marketing-accent"
            >
              <Instagram className="h-5 w-5" />
            </a>
            <a
              href="https://www.facebook.com/altitutoreducation/"
              aria-label="Altitutor on Facebook"
              target="_blank"
              rel="noreferrer"
              className="text-white/45 transition-colors hover:text-marketing-accent"
            >
              <Facebook className="h-5 w-5" />
            </a>
            <a
              href="https://www.youtube.com/@altitutor"
              aria-label="Altitutor on YouTube"
              target="_blank"
              rel="noreferrer"
              className="text-white/45 transition-colors hover:text-marketing-accent"
            >
              <Youtube className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
