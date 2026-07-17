'use client';

import { Button, SearchableSelect, useMediaQuery } from '@altitutor/ui';
import { Sparkles } from 'lucide-react';
import {
  STUDENT_TOUR_REPLAY_OPTIONS,
  useOnboardingTour,
} from '@/features/onboarding';
import { OPEN_WELCOME_MODAL_EVENT } from '@/features/welcome';
import { StudentPageContainer } from '@/shared/components/layouts';
import { studentBtnPrimary, studentCardCn } from '@/shared/lib/student-visual';
import { cn } from '@/shared/utils';
import { SettingsPageHeader } from './SettingsPageHeader';
import { SettingsRow } from './SettingsRow';

const TOUR_REPLAY_ITEMS = [...STUDENT_TOUR_REPLAY_OPTIONS];
type TourReplayOption = (typeof STUDENT_TOUR_REPLAY_OPTIONS)[number];

const SELECT_TRIGGER =
  'h-10 w-full justify-between font-normal sm:w-auto sm:min-w-[14rem] sm:max-w-md';
const SELECT_CONTENT_WIDTH = 'min(100vw - 2rem, 22rem)';

export function SettingsAppPage() {
  const { replayTour, isResetting } = useOnboardingTour();
  const isMobile = useMediaQuery('(max-width: 767px)');

  const handleShowWelcomeModal = () => {
    window.dispatchEvent(new Event(OPEN_WELCOME_MODAL_EVENT));
  };

  return (
    <StudentPageContainer className="space-y-6">
      <SettingsPageHeader
        title="App settings"
        description="Onboarding and portal preferences"
        backHref="/settings"
        backLabel="All settings"
      />

      <div className={cn(studentCardCn(), 'p-6 sm:p-8')}>
        <SettingsRow
          title="Welcome guide"
          description="Reopen the full-screen welcome guide at any time."
          control={
            <Button className={studentBtnPrimary} onClick={handleShowWelcomeModal}>
              <Sparkles className="mr-2 h-4 w-4" />
              Show again
            </Button>
          }
        />
      </div>

      <div className={cn(studentCardCn(), 'p-6 sm:p-8')}>
        <SettingsRow
          title="App tours"
          description={
            <>
              Replay a guided walkthrough for a specific area. We reset only that
              tour, then take you to the right page to play it.
              {isMobile ? ' Tours are available on desktop-width layouts.' : ''}
            </>
          }
          control={
            <div className="w-full sm:w-auto sm:min-w-[14rem] sm:max-w-md">
              <SearchableSelect<TourReplayOption>
                items={TOUR_REPLAY_ITEMS}
                value={null}
                onValueChange={(opt) => {
                  if (!opt) return;
                  void replayTour(opt.tourId, opt.href);
                }}
                getItemLabel={(item) => item.label}
                getItemId={(item) => item.tourId}
                getItemValue={(item) => `${item.label} ${item.href}`}
                placeholder="Replay app tour"
                searchPlaceholder="Search tours…"
                emptyMessage="No matching tour."
                disabled={isMobile || isResetting}
                triggerClassName={SELECT_TRIGGER}
                contentWidth={SELECT_CONTENT_WIDTH}
              />
            </div>
          }
        />
      </div>
    </StudentPageContainer>
  );
}
