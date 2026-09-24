import type { Tour } from 'nextstepjs';
import {
  BookOpen,
  Brain,
  Calendar,
  CreditCard,
  Home,
  LayoutDashboard,
  Settings,
} from 'lucide-react';

export const STUDENT_NEXTSTEP_FIXED_VIEWPORT_ID = 'student-nextstep-fixed-viewport';

/**
 * Sidebar walkthrough on the dashboard (spotlight tour after the welcome wizard).
 */
export const STUDENT_PORTAL_TOUR = 'student-portal-intro';
export const STUDENT_CLASSES_TOUR = 'student-classes-intro';
export const STUDENT_RESOURCES_TOUR = 'student-resources-intro';
export const STUDENT_FLASHCARDS_TOUR = 'student-flashcards-intro';
export const STUDENT_BILLING_TOUR = 'student-billing-intro';

const iconClassName = 'h-5 w-5';
const fixedViewport = { viewportID: STUDENT_NEXTSTEP_FIXED_VIEWPORT_ID } as const;
const standardStep = {
  showControls: true,
  showSkip: true,
  pointerPadding: 8,
  pointerRadius: 12,
} as const;

const portalTour: Tour = {
  tour: STUDENT_PORTAL_TOUR,
  steps: [
    {
      icon: <LayoutDashboard className={iconClassName} />,
      title: 'Start from the dashboard',
      content: (
        <p>
          Your dashboard shows upcoming sessions and quick links. Use the sidebar
          whenever you want to switch sections.
        </p>
      ),
      selector: "[data-tour='nav-dashboard']",
      ...fixedViewport,
      side: 'right',
      ...standardStep,
    },
    {
      icon: <Calendar className={iconClassName} />,
      title: 'Classes',
      content: (
        <p>
          Open Classes for your enrolments, timetable, drafting bookings, and
          absences.
        </p>
      ),
      selector: "[data-tour='nav-classes']",
      ...fixedViewport,
      side: 'right',
      ...standardStep,
    },
    {
      icon: <BookOpen className={iconClassName} />,
      title: 'Resources',
      content: (
        <p>Browse subject notes, topics, and files shared for your courses.</p>
      ),
      selector: "[data-tour='nav-resources']",
      ...fixedViewport,
      side: 'right',
      ...standardStep,
    },
    {
      icon: <Brain className={iconClassName} />,
      title: 'Flashcards',
      content: <p>Review due flashcards to keep key concepts fresh.</p>,
      selector: "[data-tour='nav-flashcards']",
      ...fixedViewport,
      side: 'right',
      ...standardStep,
    },
    {
      icon: <CreditCard className={iconClassName} />,
      title: 'Billing',
      content: (
        <p>Manage payment methods, invoices, and subscriptions here.</p>
      ),
      selector: "[data-tour='nav-billing']",
      ...fixedViewport,
      side: 'right',
      ...standardStep,
    },
    {
      icon: <Settings className={iconClassName} />,
      title: 'Replay a guide',
      content: (
        <p>
          Settings includes App tours. Use it if you want to see this guide or a
          page guide again.
        </p>
      ),
      selector: "[data-tour='nav-settings']",
      ...fixedViewport,
      side: 'right',
      ...standardStep,
      showSkip: false,
    },
  ],
};

const classesTour: Tour = {
  tour: STUDENT_CLASSES_TOUR,
  steps: [
    {
      icon: <Calendar className={iconClassName} />,
      title: 'Your classes hub',
      content: (
        <p>
          Book drafting sessions, log absences, and review enrolments and your
          timetable from this page.
        </p>
      ),
      selector: '#tour-classes-header',
      side: 'bottom',
      ...standardStep,
    },
    {
      icon: <Calendar className={iconClassName} />,
      title: 'Quick actions',
      content: (
        <p>Use these buttons to book a drafting session or log an absence.</p>
      ),
      selector: '#tour-classes-actions',
      side: 'bottom',
      ...standardStep,
    },
    {
      icon: <Home className={iconClassName} />,
      title: 'Enrolments & timetable',
      content: (
        <p>
          Your enrolled classes are listed above the timetable calendar for
          upcoming sessions.
        </p>
      ),
      selector: '#tour-classes-enrolments',
      side: 'top',
      ...standardStep,
      showSkip: false,
    },
  ],
};

const resourcesTour: Tour = {
  tour: STUDENT_RESOURCES_TOUR,
  steps: [
    {
      icon: <BookOpen className={iconClassName} />,
      title: 'Browse resources',
      content: (
        <p>
          Open a subject to see topics and files. You can also jump to a subject
          from the Resources menu in the sidebar.
        </p>
      ),
      selector: '#tour-resources-header',
      side: 'bottom',
      ...standardStep,
    },
    {
      icon: <BookOpen className={iconClassName} />,
      title: 'Your subjects',
      content: <p>Pick a subject card to open its notes and materials.</p>,
      selector: '#tour-resources-subjects',
      side: 'top',
      ...standardStep,
      showSkip: false,
    },
  ],
};

const flashcardsTour: Tour = {
  tour: STUDENT_FLASHCARDS_TOUR,
  steps: [
    {
      icon: <Brain className={iconClassName} />,
      title: 'Flashcard review',
      content: (
        <p>
          Cards due for review appear here. Work through them to keep spaced
          repetition on track.
        </p>
      ),
      selector: '#tour-flashcards-header',
      side: 'bottom',
      ...standardStep,
      showSkip: false,
    },
  ],
};

const billingTour: Tour = {
  tour: STUDENT_BILLING_TOUR,
  steps: [
    {
      icon: <CreditCard className={iconClassName} />,
      title: 'Billing & payments',
      content: (
        <p>
          Update your payment method, review invoices, and check subscriptions
          on this page.
        </p>
      ),
      selector: '#tour-billing-header',
      side: 'bottom',
      ...standardStep,
    },
    {
      icon: <CreditCard className={iconClassName} />,
      title: 'Payment method',
      content: <p>Keep a valid card on file so invoices can be paid smoothly.</p>,
      selector: '#tour-billing-payment-method',
      side: 'top',
      ...standardStep,
      showSkip: false,
    },
  ],
};

export const studentOnboardingTours: Tour[] = [
  portalTour,
  classesTour,
  resourcesTour,
  flashcardsTour,
  billingTour,
];

export const ALL_STUDENT_TOUR_IDS = [
  STUDENT_PORTAL_TOUR,
  STUDENT_CLASSES_TOUR,
  STUDENT_RESOURCES_TOUR,
  STUDENT_FLASHCARDS_TOUR,
  STUDENT_BILLING_TOUR,
] as const;

export const STUDENT_TOUR_REPLAY_OPTIONS = [
  { tourId: STUDENT_PORTAL_TOUR, label: 'App tour', href: '/dashboard' },
  { tourId: STUDENT_CLASSES_TOUR, label: 'Classes', href: '/classes' },
  { tourId: STUDENT_RESOURCES_TOUR, label: 'Resources', href: '/resources' },
  {
    tourId: STUDENT_FLASHCARDS_TOUR,
    label: 'Flashcards',
    href: '/resources/flashcards',
  },
  { tourId: STUDENT_BILLING_TOUR, label: 'Billing', href: '/billing' },
] as const;

const PATHNAME_TO_TOUR: Record<string, string> = {
  '/dashboard': STUDENT_PORTAL_TOUR,
  '/classes': STUDENT_CLASSES_TOUR,
  '/resources': STUDENT_RESOURCES_TOUR,
  '/resources/flashcards': STUDENT_FLASHCARDS_TOUR,
  '/billing': STUDENT_BILLING_TOUR,
};

/**
 * Maps a primary nav href to a stable `data-tour` id used by the portal tour.
 */
export function getNavTourAttr(href: string): string {
  if (href === '/resources/flashcards') return 'nav-flashcards';
  if (href === '/resources') return 'nav-resources';
  return `nav-${href.replace(/^\//, '').replace(/\//g, '-')}`;
}

export function getTourForPathname(pathname: string): string | null {
  return PATHNAME_TO_TOUR[pathname] ?? null;
}

export function getFirstSelectorForTour(tourId: string): string | null {
  return (
    studentOnboardingTours.find((tour) => tour.tour === tourId)?.steps[0]
      ?.selector ?? null
  );
}
