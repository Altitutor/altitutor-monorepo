"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@altitutor/ui";
import { CalendarPlus, FileText } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarSubscriptionDialog } from "@/features/calendar/components";
import { TutorClassesTable } from "@/features/classes/components/TutorClassesTable";
import {
  parseClassesPageTab,
  type ClassesPageTab,
} from "@/features/classes/lib/classes-page-tabs";
import { SessionsCalendarView } from "@/features/sessions/components/SessionsCalendarView";
import { SessionModal } from "@/features/sessions/components/SessionModal";
import { LogSessionModal, TutorLogsPanel } from "@/features/tutor-logs/components";
import { useUnloggedSessions } from "@/features/tutor-logs/hooks";
import { useCurrentStaff } from "@/features/staff/hooks/useStaffQuery";
import {
  SegmentedTabPanel,
  SegmentedTabPanelContent,
} from "@/shared/components/segmented-tab-panel";
import { TutorPageContainer } from "@/shared/components/layouts";

export default function ClassesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isCalendarDialogOpen, setIsCalendarDialogOpen] = useState(false);
  const [isLogSessionModalOpen, setIsLogSessionModalOpen] = useState(false);
  const [logSessionPreselectedId, setLogSessionPreselectedId] = useState<
    string | undefined
  >(undefined);
  const [logSessionCompletedCount, setLogSessionCompletedCount] = useState(0);
  const { data: currentStaff } = useCurrentStaff();
  const { data: unloggedSessions } = useUnloggedSessions(currentStaff?.id ?? "");
  const unloggedCount = unloggedSessions?.length ?? 0;

  const activeTab = parseClassesPageTab(searchParams.get("tab"));

  const setActiveTab = useCallback(
    (tab: ClassesPageTab) => {
      const nextTab = parseClassesPageTab(tab);
      const params = new URLSearchParams(searchParams.toString());
      if (nextTab === "timetable") {
        params.delete("tab");
      } else {
        params.set("tab", nextTab);
      }
      const query = params.toString();
      router.push(query ? `/classes?${query}` : "/classes", { scroll: false });
    },
    [router, searchParams],
  );

  useEffect(() => {
    const linkedSessionId = searchParams.get("session");
    if (!linkedSessionId) return;

    setSelectedSessionId(linkedSessionId);
    setIsSessionModalOpen(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("session");
    const query = params.toString();
    router.replace(query ? `/classes?${query}` : "/classes", { scroll: false });
  }, [router, searchParams]);

  const handleOpenSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setIsSessionModalOpen(true);
  };

  const handleCloseSessionModal = () => {
    setIsSessionModalOpen(false);
    setTimeout(() => setSelectedSessionId(null), 300);
  };

  const handleOpenLogSession = (preselectedSessionId?: string) => {
    setLogSessionPreselectedId(preselectedSessionId);
    setIsLogSessionModalOpen(true);
  };

  const handleCloseLogSession = () => {
    const hadPreselected = !!logSessionPreselectedId;
    setIsLogSessionModalOpen(false);
    setLogSessionPreselectedId(undefined);
    if (hadPreselected) {
      setLogSessionCompletedCount((c) => c + 1);
    }
  };

  const tabOptions: { value: ClassesPageTab; label: string; badge?: number }[] = [
    { value: "timetable", label: "Timetable" },
    { value: "classes", label: "Classes" },
    {
      value: "tutor-logs",
      label: "Tutor logs",
      badge: unloggedCount > 0 ? unloggedCount : undefined,
    },
  ];

  return (
    <div className="flex min-h-full flex-col">
      <TutorPageContainer className="flex flex-1 flex-col space-y-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Classes</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setIsCalendarDialogOpen(true)}
              className="flex items-center gap-2 rounded-xl shadow-sm"
            >
              <CalendarPlus className="h-4 w-4" />
              Add to calendar
            </Button>
            {currentStaff?.id && (
              <Button
                onClick={() => handleOpenLogSession()}
                className="flex items-center gap-2 rounded-xl shadow-sm"
              >
                <FileText className="h-4 w-4" />
                Submit Tutor Log
              </Button>
            )}
          </div>
        </header>

        <SegmentedTabPanel
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
          aria-label="Classes sections"
          options={tabOptions}
        >
          <SegmentedTabPanelContent when="timetable" activeTab={activeTab} className="mt-6">
            <SessionsCalendarView onOpenSession={handleOpenSession} />
          </SegmentedTabPanelContent>

          <SegmentedTabPanelContent when="classes" activeTab={activeTab} className="mt-6">
            <TutorClassesTable />
          </SegmentedTabPanelContent>

          <SegmentedTabPanelContent when="tutor-logs" activeTab={activeTab} className="mt-6">
            <TutorLogsPanel
              staffId={currentStaff?.id ?? null}
              onLogSession={handleOpenLogSession}
              onOpenSession={handleOpenSession}
            />
          </SegmentedTabPanelContent>
        </SegmentedTabPanel>
      </TutorPageContainer>

      <SessionModal
        isOpen={isSessionModalOpen}
        sessionId={selectedSessionId}
        onClose={handleCloseSessionModal}
        onLogSessionClick={() =>
          handleOpenLogSession(selectedSessionId ?? undefined)
        }
        currentStaffId={currentStaff?.id ?? null}
        currentStaffIdForNotes={currentStaff?.id ?? null}
        refreshTrigger={logSessionCompletedCount}
      />

      <CalendarSubscriptionDialog
        open={isCalendarDialogOpen}
        onOpenChange={setIsCalendarDialogOpen}
      />

      {currentStaff?.id && (
        <LogSessionModal
          isOpen={isLogSessionModalOpen}
          onClose={handleCloseLogSession}
          currentStaffId={currentStaff.id}
          preselectedSessionId={logSessionPreselectedId}
        />
      )}
    </div>
  );
}
