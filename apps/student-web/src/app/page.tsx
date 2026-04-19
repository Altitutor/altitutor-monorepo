"use client";

import React, { useEffect } from "react";
import {
  NavbarV2,
  HeroSectionV2,
  PhilosophySectionV2,
  ResourcesSectionV2,
  UCATSectionV2,
  CommunitySectionV2,
  GetStartedSectionV2,
  FooterV2,
  ScrollIndicatorV2,
  NoiseOverlay
} from "@/features/landing/components/v2";
import {
  HeroSection,
  FeaturesSection,
  ResourcesSection,
  UCATSection,
  CommunitySection,
  ScrollIndicator,
} from '@/features/landing';
import { GetStartedSectionWithAuth } from './GetStartedSectionWithAuth';

export default function HomePage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': 'https://student.altitutor.com/',
        url: 'https://student.altitutor.com/',
        name: 'Altitutor Student Portal | SACE & IB Online Resources',
        isPartOf: {
          '@id': 'https://student.altitutor.com/#website',
        },
        about: {
          '@id': 'https://student.altitutor.com/#organization',
        },
        inLanguage: 'en-AU',
      },
      {
        '@type': 'WebSite',
        '@id': 'https://student.altitutor.com/#website',
        url: 'https://student.altitutor.com/',
        name: 'Altitutor Student Portal',
        description: 'SACE & IB Online Resources',
        publisher: {
          '@id': 'https://student.altitutor.com/#organization',
        },
        alternateName: 'Alti Student Portal',
        inLanguage: 'en-AU',
      },
      {
        '@type': 'Organization',
        '@id': 'https://student.altitutor.com/#organization',
        name: 'Altitutor',
        alternateName: 'Alti',
        url: 'https://student.altitutor.com/',
        sameAs: [
          'https://www.facebook.com/altitutoreducation/',
          'https://twitter.com/Altitutor',
          'https://www.instagram.com/altitutor/',
          'https://www.tiktok.com/@altitutor',
          'https://www.linkedin.com/company/altitutor/',
          'https://www.youtube.com/@altitutor',
        ],
      },
    ],
  };

  useEffect(() => {
    // Hide the default layout Navbar just for the landing page
    const defaultNav = document.querySelector('nav:not(.fixed)'); // attempt to find default nav
    // Looking at common tailwind layouts, default navs are often top-0 left-0 w-full etc.
    // We will inject a style tag to hide the 1st standard nav if there is conflict.
  }, []);

  return (
    <main className="min-h-screen bg-[#F2F0E9] selection:bg-[#92b9c6] selection:text-[#1A1A1A] font-sans antialiased text-[#1A1A1A] overflow-x-hidden">
      <style dangerouslySetInnerHTML={{
        __html: `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Outfit:wght@400;500;600&family=Cormorant+Garamond:ital,wght@1,600&family=IBM+Plex+Mono:wght@400;600&display=swap');
        
        /* Hide the default Navbar from layout.tsx. */
        body > div > nav, 
        body > div > header,
        .navbar-default {
            display: none !important;
        }

        /* Remove any top padding injected globally for the layout navbar */
        main.pt-\\[var\\(--navbar-height\\)\\] {
            padding-top: 0 !important;
        }

        /* Enforce smooth scrolling on the page */
        html { scroll-behavior: smooth; }
      `}} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <NoiseOverlay />
      <ScrollIndicatorV2 />
      <NavbarV2 />

      {/* HERO */}
      <HeroSectionV2 />
      {/* <HeroSection /> */}

      {/* MISSION */}
      <PhilosophySectionV2 />

      {/* RESOURCES */}
      <ResourcesSectionV2 />
      {/* <ResourcesSection /> */}

      {/* UCAT */}
      <UCATSectionV2 />
      {/* <UCATSection /> */}

      {/* COMMUNITY */}
      <CommunitySectionV2 />
      {/* <CommunitySection /> */}

      {/* GET STARTED */}
      <GetStartedSectionV2 />
      {/* <GetStartedSectionWithAuth /> */}

      <FooterV2 />
    </main>
  );
}
