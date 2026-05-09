'use client';

import Link from 'next/link';
import { ArrowRight, Ban } from 'lucide-react';
import { Card } from '@altitutor/ui';
import { TutorPageContainer } from '@/shared/components/layouts';
import { tutorCardCn } from '@/shared/lib/tutor-visual';
import { cn } from '@/shared/utils';

export default function TutorSettingsPage() {
  return (
    <TutorPageContainer className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Tutor preferences and scheduling tools
        </p>
      </header>

      <section aria-labelledby="settings-nav-heading" className="space-y-4">
        <h2 id="settings-nav-heading" className="text-2xl font-semibold">
          Manage
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          <li>
            <Link href="/settings/blockouts" className="group block h-full">
              <Card
                className={cn(
                  tutorCardCn('h-full'),
                  'hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]',
                )}
              >
                <div className="flex items-start gap-4 p-5">
                  <div
                    className={cn(
                      'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-300',
                      'bg-rose-500/10 text-rose-700 dark:text-rose-300',
                    )}
                  >
                    <Ban className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5 pr-1">
                    <p className="text-base font-semibold leading-snug tracking-tight text-card-foreground transition-colors duration-300 group-hover:text-brand-darkBlue dark:group-hover:text-brand-lightBlue">
                      Blockout dates
                    </p>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Mark when you are unavailable for new bookings
                    </p>
                  </div>
                  <ArrowRight
                    className={cn(
                      'mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-out',
                      'group-hover:translate-x-0.5 group-hover:text-foreground',
                    )}
                    aria-hidden
                  />
                </div>
              </Card>
            </Link>
          </li>
        </ul>
      </section>
    </TutorPageContainer>
  );
}
