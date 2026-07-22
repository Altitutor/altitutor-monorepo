import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { UCAT_FEATURES } from "@/features/product-landing/ucat/ucat-feature-data";
import { UcatFeaturePreview } from "@/features/product-landing/ucat/ucat-feature-preview";
import { UcatLandingFooter } from "@/features/product-landing/ucat/ucat-landing-footer";
import { UcatLandingNavbar } from "@/features/product-landing/ucat/ucat-landing-navbar";
import { PRODUCT_LINKS } from "@/lib/site";

export function generateStaticParams() {
  return UCAT_FEATURES.map(({ slug }) => ({ slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const feature = UCAT_FEATURES.find((candidate) => candidate.slug === params.slug);
  if (!feature) return {};
  return {
    title: `${feature.eyebrow} | Altitutor UCAT`,
    description: feature.body,
    robots: { index: true, follow: true },
  };
}

export default function UcatFeaturePage({ params }: { params: { slug: string } }) {
  const feature = UCAT_FEATURES.find((candidate) => candidate.slug === params.slug);
  if (!feature) notFound();

  return (
    <main className="min-h-screen bg-marketing-cream text-marketing-charcoal">
      <UcatLandingNavbar />
      <section className="px-4 pb-24 pt-36 sm:px-8 sm:pt-44">
        <div className="mx-auto max-w-7xl">
          <Link href="/ucat/#how-it-works" className="inline-flex items-center gap-2 text-sm font-semibold text-marketing-primary hover:underline">
            <ArrowLeft className="size-4" aria-hidden /> Back to all features
          </Link>
          <div className="mt-12 grid items-center gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-marketing-primary/55">
                {feature.eyebrow}
              </p>
              <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-6xl">
                {feature.title}
              </h1>
              <p className="mt-6 text-base leading-relaxed text-marketing-charcoal/62 sm:text-lg">
                {feature.body}
              </p>
              <ul className="mt-7 space-y-3 text-sm text-marketing-charcoal/68">
                {feature.points.map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-marketing-accent/30 text-marketing-primary">
                      <Check className="size-3" aria-hidden />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
              <a href={PRODUCT_LINKS.ucatSignup} className="mt-9 inline-flex items-center gap-2 rounded-full bg-marketing-primary px-6 py-3.5 text-sm font-semibold text-white">
                Try it free <ArrowRight className="size-4" aria-hidden />
              </a>
            </div>
            <UcatFeaturePreview slug={feature.slug} />
          </div>
        </div>
      </section>
      <UcatLandingFooter />
    </main>
  );
}
