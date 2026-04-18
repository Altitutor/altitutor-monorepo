"use client";

import { MARKETING_TOKENS } from "@altitutor/shared";
import { UcatDiagnosticCard } from "./ucat-diagnostic-card";
import { UcatSchedulerCard } from "./ucat-scheduler-card";
import { UcatTelemetryCard } from "./ucat-telemetry-card";

const { typography: typo } = MARKETING_TOKENS;

export function UcatLandingFeatures() {
  return (
    <section
      id="systems"
      className="relative mt-10 flex min-h-screen w-full flex-col justify-center bg-marketing-cream py-32"
    >
      <div className="mx-auto max-w-7xl px-8">
        <div className="mb-16 text-center">
          <h2
            className={`text-4xl font-bold tracking-tight text-marketing-charcoal md:text-5xl ${typo.headingSans}`}
          >
            Dynamic Prep Systems
          </h2>
          <p
            className={`mx-auto mt-4 max-w-2xl text-xl text-marketing-charcoal/60 ${typo.secondarySans}`}
          >
            Experience the proprietary engines powering your score improvement.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <UcatDiagnosticCard />
          <UcatTelemetryCard />
          <UcatSchedulerCard />
        </div>
      </div>
    </section>
  );
}
