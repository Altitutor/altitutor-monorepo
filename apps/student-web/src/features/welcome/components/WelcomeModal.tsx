'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import {
  Loader2,
  ArrowRight,
  ArrowLeft,
  Heart,
  CreditCard,
  CalendarClock,
  MapPin,
  Briefcase,
  BookOpenCheck,
  BookOpen,
  Calculator,
  Microscope,
  PenTool,
  type LucideIcon,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from '@altitutor/ui';
import { CONTACT_EMAIL, CONTACT_PHONE, STUDENT_WELCOME_ADDRESS, SUBSIDY_INFO_URL } from '@/shared/constants';
import { studentBtnOutline, studentBtnPrimary } from '@/shared/lib/student-visual';
import { cn, getSubjectColorStyle } from '@/shared/utils';
import type { Tables } from '@altitutor/shared';

const VenueMap = dynamic(() => import('@/shared/components/VenueMap').then(mod => ({ default: mod.VenueMap })), {
  ssr: false,
  loading: () => <div className="h-[170px] w-full rounded-md bg-muted animate-pulse" />,
});

const disciplineIconMap: Record<string, LucideIcon> = {
  ENGLISH: PenTool,
  MATHEMATICS: Calculator,
  SCIENCE: Microscope,
};

interface WelcomeSubject {
  id: string;
  name: string;
  long_name: string | null;
  curriculum: string | null;
  year_level: number | null;
  color: string | null;
  discipline: string | null;
  hourly_rate_cents: number;
}

interface WelcomeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAcknowledge: () => void;
  isSubmitting: boolean;
  studentFirstName: string | null;
  subjects: WelcomeSubject[];
  homeworkHelpTime: string | null;
  defaultClassHourlyRateCents: number | null;
  isContextLoading: boolean;
}

interface InfoCard {
  title: string;
  icon: LucideIcon;
  estimatedHeight: number;
  body: ReactNode;
}

export function WelcomeModal({
  open,
  onOpenChange,
  onAcknowledge,
  isSubmitting,
  studentFirstName,
  subjects,
  homeworkHelpTime,
  defaultClassHourlyRateCents,
  isContextLoading,
}: WelcomeModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [cardsVisible, setCardsVisible] = useState(false);
  const [stepThreeVisible, setStepThreeVisible] = useState(false);
  const [infoPageIndex, setInfoPageIndex] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setInfoPageIndex(0);
  }, [open]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const apply = () => setIsDesktop(mediaQuery.matches);

    apply();
    mediaQuery.addEventListener('change', apply);
    return () => mediaQuery.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (step !== 2) {
      setCardsVisible(false);
      return;
    }

    // Force a reset before each info page render so entrance animations replay.
    setCardsVisible(false);
    let frameA = 0;
    let frameB = 0;
    frameA = requestAnimationFrame(() => {
      frameB = requestAnimationFrame(() => setCardsVisible(true));
    });

    return () => {
      cancelAnimationFrame(frameA);
      cancelAnimationFrame(frameB);
    };
  }, [step, infoPageIndex]);

  useEffect(() => {
    if (step !== 3) {
      setStepThreeVisible(false);
      return;
    }

    let frameA = 0;
    let frameB = 0;
    frameA = requestAnimationFrame(() => {
      frameB = requestAnimationFrame(() => setStepThreeVisible(true));
    });

    return () => {
      cancelAnimationFrame(frameA);
      cancelAnimationFrame(frameB);
    };
  }, [step]);

  const formatCurrencyPerHour = (cents: number | null) => {
    if (cents === null) return '-';
    const dollars = cents / 100;
    const amount = Number.isInteger(dollars) ? dollars.toFixed(0) : dollars.toFixed(2);
    return `$${amount}/hour`;
  };

  const subjectChips = useMemo(() => subjects, [subjects]);

  const priceBySubject = useMemo(
    () =>
      subjectChips.map((subject) => ({
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
      })),
    [subjectChips]
  );

  const infoCards = useMemo<InfoCard[]>(
    () => [
      {
        title: 'Billing',
        icon: CreditCard,
        estimatedHeight: 300,
        body: (
          <>
            <p>
              Sessions are automatically billed at 7:00pm on the day before the session. The cost for sessions is{' '}
              <strong className="text-foreground">{formatCurrencyPerHour(defaultClassHourlyRateCents)}</strong>{' '}
              for standard class billing. If you would like to apply for a subsidy,{' '}
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
              You can remove or change your card at any time by clicking payment information on the left toolbar.
            </p>
            {priceBySubject.length > 0 && (
              <div className="mt-3 rounded-md border border-border/60 bg-background/60 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">
                  Your Subject Pricing
                </p>
                <div className="space-y-1.5">
                  {priceBySubject.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate">{item.label}</span>
                      <strong className="text-foreground">{item.priceLabel}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ),
      },
      {
        title: 'Scheduling',
        icon: CalendarClock,
        estimatedHeight: 180,
        body: (
          <>
            <p>
              If the student misses any lessons, let us know via text and we will offer replacement lesson time(s).
            </p>
            <p className="mt-2">
              If you let us know at least 24 hours in advance, you also have the option to deduct the session from the
              next week&apos;s invoice.
            </p>
          </>
        ),
      },
      {
        title: 'Location and Contact',
        icon: MapPin,
        estimatedHeight: 360,
        body: (
          <>
            <p>
              Sessions are held at our office: <strong className="text-foreground">{STUDENT_WELCOME_ADDRESS}</strong>.
            </p>
            <p className="mt-2">
              If you have any questions, please reach out via text or phone call at{' '}
              <strong className="text-foreground">{CONTACT_PHONE}</strong> or email{' '}
              <strong className="text-foreground">{CONTACT_EMAIL}</strong>.
            </p>
            <div className="mt-3 overflow-hidden rounded-md border border-border/60">
              <VenueMap height="170px" />
            </div>
          </>
        ),
      },
      {
        title: 'What to Bring',
        icon: Briefcase,
        estimatedHeight: 220,
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
        estimatedHeight: 180,
        body: (
          <>
            <p>
              Homework help sessions run from{' '}
              <strong className="text-foreground">{homeworkHelpTime ?? 'the latest published schedule'}</strong> and
              are completely free for students to attend.
            </p>
            <p className="mt-2">
              Bring any work you need help with, or ask the admin staff to print any resources when you arrive.
            </p>
          </>
        ),
      },
    ],
    [homeworkHelpTime, defaultClassHourlyRateCents, priceBySubject]
  );

  const infoPages = useMemo(() => {
    const pageHeightBudget = isDesktop ? 620 : 440;
    const pages: InfoCard[][] = [];
    let currentPage: InfoCard[] = [];
    let currentHeight = 0;

    for (const card of infoCards) {
      const nextHeight = currentHeight + card.estimatedHeight;
      if (currentPage.length > 0 && nextHeight > pageHeightBudget) {
        pages.push(currentPage);
        currentPage = [card];
        currentHeight = card.estimatedHeight;
      } else {
        currentPage.push(card);
        currentHeight = nextHeight;
      }
    }

    if (currentPage.length > 0) pages.push(currentPage);
    return pages;
  }, [infoCards, isDesktop]);

  const currentInfoCards = infoPages[infoPageIndex] ?? [];
  const isLastInfoPage = infoPageIndex >= infoPages.length - 1;
  const isFirstInfoPage = infoPageIndex === 0;

  const handleBack = () => {
    if (step === 1) return;
    if (step === 3) {
      setStep(2);
      setInfoPageIndex(Math.max(infoPages.length - 1, 0));
      return;
    }
    if (!isFirstInfoPage) {
      setInfoPageIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    setStep(1);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-[min(96vw,1100px)] max-w-none h-[min(88vh,760px)] overflow-hidden p-0 flex flex-col">
        <AlertDialogHeader className="border-b px-6 py-4">
          <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <span className={step === 1 ? 'font-semibold text-foreground' : ''}>Step 1</span>
            <span>/</span>
            <span className={step === 2 ? 'font-semibold text-foreground' : ''}>Step 2</span>
            <span>/</span>
            <span className={step === 3 ? 'font-semibold text-foreground' : ''}>Step 3</span>
          </div>
          <AlertDialogTitle className="text-2xl">
            {step === 1
              ? `Welcome, ${studentFirstName ?? 'Student'}`
              : step === 2
                ? 'Important Information'
                : 'Finish tutorial'}
          </AlertDialogTitle>
          <AlertDialogDescription className="sr-only">Welcome modal with onboarding details</AlertDialogDescription>
        </AlertDialogHeader>

        <div className={cn('flex-1 px-6 py-5', step === 1 ? 'overflow-y-auto' : 'overflow-hidden')}>
          {step === 1 ? (
            <section className="animate-in fade-in-0 slide-in-from-bottom-2 duration-500 space-y-4">
              <p className="text-m text-muted-foreground leading-relaxed">
                Thank you for registering to be a student with us at Altitutor. You have registered to be enrolled in
                classes for the following subjects:
              </p>

              <div className="rounded-lg border bg-muted/20 p-4">
                {isContextLoading ? (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading your subjects...
                  </div>
                ) : subjectChips.length === 0 ? (
                  <div className="text-m text-muted-foreground leading-relaxed">
                    Your selected subjects will appear here once loaded.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {subjectChips.map((subject) => {
                      const subjectForColor = { color: subject.color } as Tables<'subjects'>;
                      const { style, textColorClass } = getSubjectColorStyle(subjectForColor);
                      const Icon = (subject.discipline && disciplineIconMap[subject.discipline]) || BookOpen;
                      const label =
                        subject.long_name ||
                        [
                          subject.curriculum,
                          subject.year_level !== null && subject.year_level !== undefined
                            ? `Year ${subject.year_level}`
                            : null,
                          subject.name,
                        ]
                          .filter(Boolean)
                          .join(' ');

                      return (
                        <span
                          key={subject.id}
                          className={cn(
                            'inline-flex items-center gap-2 rounded-md border border-transparent px-3 py-1.5 text-sm',
                            subject.color ? textColorClass : 'bg-muted text-foreground border-border'
                          )}
                          style={subject.color ? style : undefined}
                        >
                          <Icon className="h-4 w-4" />
                          {label}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              <p className="text-m text-muted-foreground leading-relaxed">
                Our admin staff are currently working on enrolling you in sessions for these subjects. You will receive
                a text message with your classes, and your schedule on the Altitutor Student portal will be updated.
              </p>
            </section>
          ) : step === 2 ? (
            <section className="h-full animate-in fade-in-0 slide-in-from-right-4 duration-400">
              <div className="grid h-full gap-3 sm:grid-cols-2">
                {currentInfoCards.map((card, index) => (
                  <article
                    key={`${card.title}-${infoPageIndex}`}
                    className="group rounded-lg border border-border/60 bg-muted/35 p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                    style={{
                      opacity: cardsVisible ? 1 : 0,
                      transform: cardsVisible ? 'translateY(0)' : 'translateY(8px)',
                      transition: 'opacity 280ms ease, transform 280ms ease',
                      transitionDelay: `${index * 90}ms`,
                    }}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-brand-lightBlue/20 text-brand-mediumBlue dark:bg-brand-lightBlue/25 dark:text-brand-lightBlue">
                        <card.icon className="h-4 w-4" />
                      </span>
                      <h3 className="text-xl font-semibold tracking-wide text-foreground">{card.title}</h3>
                    </div>
                    <div className="text-m leading-relaxed text-muted-foreground">{card.body}</div>
                  </article>
                ))}
              </div>
            </section>
          ) : (
            <section className="flex h-full flex-col items-center justify-center text-center">
              <p
                className="text-xl font-semibold text-foreground transition-all duration-500"
                style={{
                  opacity: stepThreeVisible ? 1 : 0,
                  transform: stepThreeVisible ? 'translateY(0)' : 'translateY(10px)',
                }}
              >
                Welcome to Altitutor!
              </p>
              <div
                className="my-5 inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand-lightBlue/20 dark:bg-brand-lightBlue/25 transition-all duration-500"
                style={{
                  opacity: stepThreeVisible ? 1 : 0,
                  transform: stepThreeVisible ? 'scale(1)' : 'scale(0.92)',
                  transitionDelay: '120ms',
                }}
              >
                <Heart className="h-8 w-8 text-brand-mediumBlue dark:text-brand-lightBlue animate-pulse" />
              </div>
              <p
                className="text-m text-muted-foreground leading-relaxed transition-all duration-500"
                style={{
                  opacity: stepThreeVisible ? 1 : 0,
                  transform: stepThreeVisible ? 'translateY(0)' : 'translateY(10px)',
                  transitionDelay: '220ms',
                }}
              >
                We can&apos;t wait to see you
              </p>
            </section>
          )}
        </div>

        <AlertDialogFooter className="border-t px-6 py-4 flex-row justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            disabled={step === 1 || isSubmitting}
            className={cn(studentBtnOutline, 'transition-all duration-200 hover:-translate-x-0.5')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          {step === 1 ? (
            <Button
              type="button"
              onClick={() => setStep(2)}
              disabled={isContextLoading}
              className={cn(studentBtnPrimary, 'transition-all duration-200 hover:translate-x-0.5')}
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : !isLastInfoPage ? (
            <Button
              type="button"
              onClick={() => setInfoPageIndex((prev) => Math.min(prev + 1, infoPages.length - 1))}
              className={cn(studentBtnPrimary, 'transition-all duration-200 hover:translate-x-0.5')}
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : step === 2 ? (
            <Button
              type="button"
              onClick={() => setStep(3)}
              className={cn(studentBtnPrimary, 'transition-all duration-200 hover:translate-x-0.5')}
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              className={studentBtnPrimary}
              onClick={onAcknowledge}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Finish'
              )}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
