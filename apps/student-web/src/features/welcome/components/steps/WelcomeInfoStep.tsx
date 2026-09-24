'use client';

import dynamic from 'next/dynamic';
import {
  BookOpenCheck,
  Briefcase,
  CalendarClock,
  CreditCard,
  MapPin,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import {
  CONTACT_EMAIL,
  CONTACT_PHONE,
  STUDENT_WELCOME_ADDRESS,
  SUBSIDY_INFO_URL,
} from '@/shared/constants';
import type { WelcomeSubject } from './WelcomeIntroStep';

const VenueMap = dynamic(
  () =>
    import('@/shared/components/VenueMap').then((mod) => ({
      default: mod.VenueMap,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[170px] w-full animate-pulse rounded-md bg-muted" />
    ),
  },
);

export type WelcomeInfoCard = {
  title: string;
  icon: LucideIcon;
  body: ReactNode;
};

function formatCurrencyPerHour(cents: number | null): string {
  if (cents === null) return '-';
  const dollars = cents / 100;
  const amount = Number.isInteger(dollars) ? dollars.toFixed(0) : dollars.toFixed(2);
  return `$${amount}/hour`;
}

export function buildWelcomeInfoCards(args: {
  subjects: WelcomeSubject[];
  homeworkHelpTime: string | null;
  defaultClassHourlyRateCents: number | null;
}): WelcomeInfoCard[] {
  const priceBySubject = args.subjects.map((subject) => ({
    id: subject.id,
    label:
      subject.long_name ||
      [
        subject.curriculum,
        subject.year_level !== null && subject.year_level !== undefined
          ? `Year ${subject.year_level}`
          : null,
        subject.name,
      ]
        .filter(Boolean)
        .join(' '),
    priceLabel: formatCurrencyPerHour(subject.hourly_rate_cents),
  }));

  return [
    {
      title: 'Billing',
      icon: CreditCard,
      body: (
        <>
          <p>
            Sessions are automatically billed at 7:00pm on the day before the
            session. The cost for sessions is{' '}
            <strong className="text-foreground">
              {formatCurrencyPerHour(args.defaultClassHourlyRateCents)}
            </strong>{' '}
            for standard class billing. If you would like to apply for a
            subsidy,{' '}
            <a
              href={SUBSIDY_INFO_URL}
              target="_blank"
              rel="noreferrer"
              className="text-brand-mediumBlue underline underline-offset-2"
            >
              click here
            </a>
            .
          </p>
          <p className="mt-2">
            You can remove or change your card at any time by clicking payment
            information on the left toolbar.
          </p>
          {priceBySubject.length > 0 ? (
            <div className="mt-3 rounded-md bg-background/60 p-3 ring-1 ring-black/[0.06] dark:ring-white/10">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">
                Your Subject Pricing
              </p>
              <div className="space-y-1.5">
                {priceBySubject.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="truncate">{item.label}</span>
                    <strong className="text-foreground">{item.priceLabel}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ),
    },
    {
      title: 'Scheduling',
      icon: CalendarClock,
      body: (
        <>
          <p>
            If the student misses any lessons, let us know via text and we will
            offer replacement lesson time(s).
          </p>
          <p className="mt-2">
            If you let us know at least 24 hours in advance, you also have the
            option to deduct the session from the next week&apos;s invoice.
          </p>
        </>
      ),
    },
    {
      title: 'Location and Contact',
      icon: MapPin,
      body: (
        <>
          <p>
            Sessions are held at our office:{' '}
            <strong className="text-foreground">{STUDENT_WELCOME_ADDRESS}</strong>
            .
          </p>
          <p className="mt-2">
            If you have any questions, please reach out via text or phone call
            at <strong className="text-foreground">{CONTACT_PHONE}</strong> or
            email <strong className="text-foreground">{CONTACT_EMAIL}</strong>.
          </p>
          <div className="mt-3 overflow-hidden rounded-md ring-1 ring-black/[0.06] dark:ring-white/10">
            <VenueMap height="170px" />
          </div>
        </>
      ),
    },
    {
      title: 'What to Bring',
      icon: Briefcase,
      body: (
        <ul className="list-disc space-y-1 pl-5">
          <li>A pen or something to write with</li>
          <li>Graphics calculator</li>
          <li>Your school syllabus</li>
          <li>Laptop / iPad</li>
        </ul>
      ),
    },
    {
      title: 'Homework Help Sessions',
      icon: BookOpenCheck,
      body: (
        <>
          <p>
            Homework help sessions run from{' '}
            <strong className="text-foreground">
              {args.homeworkHelpTime ?? 'the latest published schedule'}
            </strong>{' '}
            and are completely free for students to attend.
          </p>
          <p className="mt-2">
            Bring any work you need help with, or ask the admin staff to print
            any resources when you arrive.
          </p>
        </>
      ),
    },
  ];
}

type WelcomeInfoStepProps = {
  cards: WelcomeInfoCard[];
};

export function WelcomeInfoStep({ cards }: WelcomeInfoStepProps) {
  return (
    <section className="grid gap-3 sm:grid-cols-2">
      {cards.map((card, index) => (
        <article
          key={`${card.title}-${index}`}
          className="rounded-2xl bg-muted/35 p-4 shadow-sm ring-1 ring-black/[0.06] transition-shadow duration-300 hover:shadow-md dark:ring-white/10"
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-brand-lightBlue/20 text-brand-mediumBlue dark:bg-brand-lightBlue/25 dark:text-brand-lightBlue">
              <card.icon className="h-4 w-4" />
            </span>
            <h3 className="text-xl font-semibold tracking-wide text-foreground">
              {card.title}
            </h3>
          </div>
          <div className="text-base leading-relaxed text-muted-foreground">
            {card.body}
          </div>
        </article>
      ))}
    </section>
  );
}
