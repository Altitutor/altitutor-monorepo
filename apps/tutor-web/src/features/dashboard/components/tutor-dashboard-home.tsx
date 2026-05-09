'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Calendar,
  Settings,
  User,
  type LucideIcon,
} from 'lucide-react';
import { Card } from '@altitutor/ui';
import { TutorPageContainer } from '@/shared/components/layouts';
import { tutorCardCn } from '@/shared/lib/tutor-visual';
import { cn } from '@/shared/utils';
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess';

type QuickLinkItem = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  accentClass: string;
};

const baseQuickLinks: QuickLinkItem[] = [
  {
    title: 'Classes',
    description: 'Timetable, sessions, and tutor logs',
    href: '/classes',
    icon: Calendar,
    accentClass:
      'bg-brand-darkBlue/10 text-brand-darkBlue dark:bg-brand-lightBlue/15 dark:text-brand-lightBlue',
  },
  {
    title: 'Resources',
    description: 'Learning materials (coming soon)',
    href: '/resources',
    icon: BookOpen,
    accentClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  },
  {
    title: 'Settings',
    description: 'Blockout dates and tutor preferences',
    href: '/settings',
    icon: Settings,
    accentClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
  },
  {
    title: 'My profile',
    description: 'Details, availability, and account',
    href: '/my-profile',
    icon: User,
    accentClass: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
];

const ucatQuickLink: QuickLinkItem = {
  title: 'UCAT',
  description: 'Questions, sets, mocks, and student progress',
  href: '/ucat',
  icon: BrainCircuit,
  accentClass: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
};

export interface TutorDashboardHomeProps {
  firstName: string | null;
}

export function TutorDashboardHome({ firstName }: TutorDashboardHomeProps) {
  const ucatAccess = useUcatAccess();
  const displayName = firstName?.trim() || 'Tutor';

  const quickLinks = ucatAccess.data
    ? [baseQuickLinks[0], ucatQuickLink, ...baseQuickLinks.slice(1)]
    : baseQuickLinks;

  return (
    <div className="min-h-full">
      <TutorPageContainer className="space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Hi, {displayName}</h1>
          <p className="max-w-2xl text-pretty text-muted-foreground">
            Welcome to Altitutor Tutor — manage classes, materials, and your profile from here.
          </p>
        </header>

        <section aria-labelledby="quick-links-heading" className="space-y-4">
          <h2 id="quick-links-heading" className="text-2xl font-semibold">
            Quick links
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {quickLinks.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link href={item.href} className="group block h-full">
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
                            item.accentClass,
                          )}
                        >
                          <Icon className="h-5 w-5" aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1.5 pr-1">
                          <p className="text-base font-semibold leading-snug tracking-tight text-card-foreground transition-colors duration-300 group-hover:text-brand-darkBlue dark:group-hover:text-brand-lightBlue">
                            {item.title}
                          </p>
                          <p className="text-sm leading-relaxed text-muted-foreground">
                            {item.description}
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
              );
            })}
          </ul>
        </section>
      </TutorPageContainer>
    </div>
  );
}
