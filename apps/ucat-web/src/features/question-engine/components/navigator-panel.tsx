import { Flag, Navigation } from "lucide-react";
import { UcatExamActionButton, UcatFloatingPanel } from "@altitutor/ui";
import {
  UCAT_COLORS,
  UCAT_FONTS,
} from "@altitutor/ui/src/components/ucat/ucat-theme";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { QuestionItem } from "@/features/question-engine/model/types";
import { getReviewQuestionStatus } from "@/features/question-engine/lib/review";
import { useDraggablePanel } from "@/features/question-engine/hooks/use-draggable-panel";

const DEFAULT_WIDTH = 520;
const DEFAULT_HEIGHT = 280;
const MIN_WIDTH = 320;
const MIN_HEIGHT = 240;

function getShellRect(): DOMRect | null {
  const shell = document.querySelector(
    '[data-ucat-shell-root="true"]',
  ) as HTMLElement | null;
  return shell ? shell.getBoundingClientRect() : null;
}

export function NavigatorPanel({
  questions,
  currentIndex,
  flaggedIds,
  selectedAnswers,
  visitedQuestionIds,
  syllogismSnapshots,
  onSelect,
  onClose,
}: {
  questions: QuestionItem[];
  currentIndex: number;
  flaggedIds: string[];
  selectedAnswers: Record<string, string>;
  visitedQuestionIds: string[];
  syllogismSnapshots?: Record<string, Record<string, boolean>>;
  onSelect: (index: number) => void;
  onClose: () => void;
}) {
  const { position, handleMouseDown, setPosition } = useDraggablePanel();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  });
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null);
  const [hoveredTextRowIndex, setHoveredTextRowIndex] = useState<number | null>(
    null,
  );
  const [sortField, setSortField] = useState<"question" | "status" | "flagged">(
    "question",
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const resizeState = useRef({
    isResizing: false,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    panelLeft: 0,
    panelTop: 0,
  });

  const unseenOrIncompleteCount = questions.reduce((count, question) => {
    const status = getReviewQuestionStatus(
      question,
      visitedQuestionIds,
      selectedAnswers,
      syllogismSnapshots,
    );
    return status === "complete" ? count : count + 1;
  }, 0);

  // Keep navigator panel fully within the UCAT exam shell
  useEffect(() => {
    const shellRect = getShellRect();
    const panel = panelRef.current;
    if (!shellRect || !panel) return;

    const panelRect = panel.getBoundingClientRect();

    let dx = 0;
    let dy = 0;

    if (panelRect.left < shellRect.left) {
      dx = shellRect.left - panelRect.left;
    } else if (panelRect.right > shellRect.right) {
      dx = shellRect.right - panelRect.right;
    }

    if (panelRect.top < shellRect.top) {
      dy = shellRect.top - panelRect.top;
    } else if (panelRect.bottom > shellRect.bottom) {
      dy = shellRect.bottom - panelRect.bottom;
    }

    if (dx !== 0 || dy !== 0) {
      setPosition((current) => ({
        x: current.x + dx,
        y: current.y + dy,
      }));
    }
  }, [position.x, position.y, setPosition, size.width, size.height]);

  const handleResizeMouseMove = useCallback((event: MouseEvent) => {
    if (!resizeState.current.isResizing) return;
    const shellRect = getShellRect();
    const { startX, startY, startWidth, startHeight, panelLeft, panelTop } =
      resizeState.current;
    let newWidth = startWidth + (event.clientX - startX);
    let newHeight = startHeight + (event.clientY - startY);
    if (shellRect) {
      const maxWidth = shellRect.right - panelLeft;
      const maxHeight = shellRect.bottom - panelTop;
      newWidth = Math.min(newWidth, maxWidth);
      newHeight = Math.min(newHeight, maxHeight);
    }
    newWidth = Math.max(MIN_WIDTH, newWidth);
    newHeight = Math.max(MIN_HEIGHT, newHeight);
    setSize({ width: newWidth, height: newHeight });
  }, []);

  const handleResizeMouseUp = useCallback(() => {
    if (!resizeState.current.isResizing) return;
    resizeState.current.isResizing = false;
    window.removeEventListener("mousemove", handleResizeMouseMove);
    window.removeEventListener("mouseup", handleResizeMouseUp);
  }, [handleResizeMouseMove]);

  const handleResizeMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const panel = panelRef.current;
      if (!panel) return;
      const panelRect = panel.getBoundingClientRect();
      resizeState.current = {
        isResizing: true,
        startX: event.clientX,
        startY: event.clientY,
        startWidth: size.width,
        startHeight: size.height,
        panelLeft: panelRect.left,
        panelTop: panelRect.top,
      };
      window.addEventListener("mousemove", handleResizeMouseMove);
      window.addEventListener("mouseup", handleResizeMouseUp);
    },
    [size.width, size.height, handleResizeMouseMove, handleResizeMouseUp],
  );

  useEffect(() => {
    return () => {
      window.removeEventListener("mousemove", handleResizeMouseMove);
      window.removeEventListener("mouseup", handleResizeMouseUp);
    };
  }, [handleResizeMouseMove, handleResizeMouseUp]);

  const sortedRows = useMemo(() => {
    const base = questions.map((question, index) => {
      const flagged = flaggedIds.includes(question.id);
      const status = getReviewQuestionStatus(
        question,
        visitedQuestionIds,
        selectedAnswers,
        syllogismSnapshots,
      );
      const statusLabel =
        status === "complete"
          ? ""
          : status === "incomplete"
            ? "Incomplete"
            : "Unseen";
      const statusRank =
        status === "complete" ? 1 : status === "incomplete" ? 0.5 : 0;
      const flaggedRank = flagged ? 0 : 1;

      return {
        question,
        index,
        flagged,
        answered: status === "complete",
        statusLabel,
        statusRank,
        flaggedRank,
      };
    });

    const directionFactor = sortDirection === "asc" ? 1 : -1;

    return base.sort((a, b) => {
      if (sortField === "question") {
        return (a.index - b.index) * directionFactor;
      }

      if (sortField === "status") {
        if (a.statusRank !== b.statusRank) {
          return (a.statusRank - b.statusRank) * directionFactor;
        }
        // tie-breaker by question index
        return (a.index - b.index) * directionFactor;
      }

      // sortField === 'flagged'
      if (a.flaggedRank !== b.flaggedRank) {
        return (a.flaggedRank - b.flaggedRank) * directionFactor;
      }
      return (a.index - b.index) * directionFactor;
    });
  }, [
    questions,
    flaggedIds,
    selectedAnswers,
    visitedQuestionIds,
    syllogismSnapshots,
    sortField,
    sortDirection,
  ]);

  const handleHeaderClick = (field: "question" | "status" | "flagged") => {
    if (sortField === field) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const renderSortIndicator = (field: "question" | "status" | "flagged") => {
    if (sortField !== field) return <span className="inline-block w-3" />;
    return (
      <span className="inline-block w-3 text-[9px] align-middle">
        {sortDirection === "asc" ? "▲" : "▼"}
      </span>
    );
  };

  return (
    <div
      ref={panelRef}
      className="pointer-events-auto relative"
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        width: size.width,
        height: size.height,
      }}
    >
      <UcatFloatingPanel
        title="Navigator - select a question to go to it"
        titleIcon={<Navigation className="h-5 w-5" />}
        onDragMouseDown={handleMouseDown}
        className="h-full w-full min-w-0 min-h-0 max-h-[85vh] flex flex-col overflow-hidden"
        contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            className={`min-h-0 flex-1 overflow-y-auto font-[${UCAT_FONTS.message}] text-[11pt] text-black`}
            style={{ backgroundColor: "white" }}
          >
            <table className="w-full border-collapse">
              <thead
                style={{ backgroundColor: UCAT_COLORS.toolbarBlue }}
                className="sticky top-0 z-10 text-white"
              >
                <tr>
                  <th
                    className="cursor-pointer border border-[#9ba9bd] px-2 py-1.5 text-left font-normal select-none"
                    onClick={() => handleHeaderClick("question")}
                  >
                    <span>Question #</span> {renderSortIndicator("question")}
                  </th>
                  <th
                    className="cursor-pointer border border-[#9ba9bd] px-2 py-1.5 text-left font-normal select-none"
                    onClick={() => handleHeaderClick("status")}
                  >
                    <span>Status</span> {renderSortIndicator("status")}
                  </th>
                  <th
                    className="cursor-pointer border border-[#9ba9bd] px-2 py-1.5 text-left font-normal select-none"
                    onClick={() => handleHeaderClick("flagged")}
                  >
                    <span>Flagged</span> {renderSortIndicator("flagged")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => {
                  const isCurrent = row.index === currentIndex;
                  const isRowHovered = hoveredRowIndex === row.index;
                  const isTextHovered = hoveredTextRowIndex === row.index;
                  const backgroundColor =
                    isCurrent || isRowHovered
                      ? UCAT_COLORS.highlightYellow
                      : UCAT_COLORS.mutedGray;
                  return (
                    <tr
                      key={row.question.id}
                      className={`group border-b ${
                        isRowHovered ? "border-[#1b4c7d]" : "border-transparent"
                      }`}
                      style={{ backgroundColor }}
                      onMouseEnter={() => setHoveredRowIndex(row.index)}
                      onMouseLeave={() => setHoveredRowIndex(null)}
                    >
                      <td
                        className="cursor-pointer border border-[#9ba9bd] px-2 py-1.5"
                        onDoubleClick={() => onSelect(row.index)}
                      >
                        <span
                          className={isTextHovered ? "underline" : undefined}
                          onMouseEnter={() => setHoveredTextRowIndex(row.index)}
                          onMouseLeave={() =>
                            setHoveredTextRowIndex((current) =>
                              current === row.index ? null : current,
                            )
                          }
                        >
                          Question {row.index + 1}
                        </span>
                      </td>
                      <td className="border border-[#9ba9bd] px-2 py-1.5 text-[#d90000]">
                        {row.statusLabel}
                      </td>
                      <td className="border border-[#9ba9bd] px-2 py-1.5 text-center align-middle">
                        {row.flagged ? (
                          <span className="inline-flex items-center justify-center">
                            <Flag className="h-4 w-4" aria-hidden="true" />
                            <span className="sr-only">Flagged for review</span>
                          </span>
                        ) : (
                          ""
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex shrink-0 flex-col gap-15">
            <div className="text-left text-[11pt]">
              {unseenOrIncompleteCount} Unseen/Incomplete
            </div>
            <div className="flex justify-end">
              <UcatExamActionButton borders="all" onClick={onClose}>
                <span>
                  <span className="underline">C</span>lose
                </span>
              </UcatExamActionButton>
            </div>
          </div>
        </div>
      </UcatFloatingPanel>
      <div
        role="separator"
        aria-label="Resize navigator"
        className="absolute bottom-0 right-0 z-10 flex cursor-se-resize items-end justify-end rounded-bl-md p-1"
        style={{ backgroundColor: "rgba(0,0,0,0.15)" }}
        onMouseDown={handleResizeMouseDown}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className="text-white/80"
          aria-hidden
        >
          <path
            d="M12 12H8L12 8M6 12H2L12 2M0 12V8L4 12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
