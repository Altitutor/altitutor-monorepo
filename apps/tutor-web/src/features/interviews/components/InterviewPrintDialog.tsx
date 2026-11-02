"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  Checkbox,
  Input,
  SegmentedControl,
  type JSONContent,
} from "@altitutor/ui";
import {
  interviewText,
  type InterviewCatalog,
  type InterviewRichText,
  type InterviewTemplate,
} from "@altitutor/shared";
import { UcatDialogShell } from "@/features/ucat/shared/dialog-shell";
import { InterviewDocument } from "./interview-ui";

type Align = "left" | "center" | "right";
type VerticalAlign = "top" | "middle" | "bottom";
type Orientation = "landscape" | "portrait";

type PrintPage = {
  placementId: string;
  number: number;
  name: string;
  prompt: InterviewRichText;
};

const promptType =
  "[&_.ProseMirror]:!max-w-none [&_.ProseMirror]:!pl-0 [&_.ProseMirror]:!text-[length:inherit] [&_.ProseMirror]:!leading-[1.25] [&_.ProseMirror]:!text-black [&_.ProseMirror_h1]:!text-[1em] [&_.ProseMirror_h2]:!text-[1em] [&_.ProseMirror_h3]:!text-[1em] [&_.ProseMirror_p]:!my-[0.35em]";

function pagesFor(
  interview: InterviewTemplate,
  catalog: InterviewCatalog,
): PrintPage[] {
  return interview.stations.flatMap((placement, index) => {
    const station = catalog.stations.find((item) => item.id === placement.stationId);
    if (!station) return [];
    return [
      {
        placementId: placement.id,
        number: index + 1,
        name: station.name,
        prompt: station.prompt,
      },
    ];
  });
}

function pageBox(orientation: Orientation) {
  return orientation === "landscape"
    ? { widthMm: 297, heightMm: 210, size: "A4 landscape" }
    : { widthMm: 210, heightMm: 297, size: "A4 portrait" };
}

function PromptSheet({
  page,
  fontPt,
  align,
  verticalAlign,
  showNumber,
  showName,
  widthMm,
  heightMm,
  measure,
  onFitted,
}: {
  page: PrintPage;
  fontPt: number;
  align: Align;
  verticalAlign: VerticalAlign;
  showNumber: boolean;
  showName: boolean;
  widthMm: number;
  heightMm: number;
  measure: boolean;
  onFitted: (placementId: string, size: number) => void;
}) {
  const frameRef = useRef<HTMLElement>(null);
  const onFittedRef = useRef(onFitted);
  onFittedRef.current = onFitted;
  const promptKey = interviewText(page.prompt);
  useLayoutEffect(() => {
    if (!measure) return;
    const frame = frameRef.current;
    const content = frame?.querySelector<HTMLElement>("[data-print-content]");
    const copy = frame?.querySelector<HTMLElement>("[data-print-copy]");
    if (!frame || !content || !copy) return;
    let cancelled = false;
    const fit = () => {
      if (cancelled) return;
      let low = 8;
      let high = 200;
      let best = 8;
      const style = getComputedStyle(content);
      const padY =
        Number.parseFloat(style.paddingTop) +
        Number.parseFloat(style.paddingBottom);
      const padX =
        Number.parseFloat(style.paddingLeft) +
        Number.parseFloat(style.paddingRight);
      const availableY =
        content.clientHeight - (Number.isFinite(padY) ? padY : 0);
      const availableX =
        content.clientWidth - (Number.isFinite(padX) ? padX : 0);
      for (let step = 0; step < 16; step += 1) {
        const mid = (low + high) / 2;
        content.style.fontSize = `${mid}pt`;
        const overflows =
          copy.scrollHeight > availableY + 1 ||
          copy.scrollWidth > availableX + 1;
        if (overflows) high = mid;
        else {
          best = mid;
          low = mid;
        }
      }
      content.style.fontSize = `${best}pt`;
      onFittedRef.current(page.placementId, Math.round(best * 10) / 10);
    };
    fit();
    const retry = window.setTimeout(fit, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(retry);
    };
  }, [
    measure,
    page.placementId,
    page.name,
    page.number,
    promptKey,
    align,
    showNumber,
    showName,
    widthMm,
    heightMm,
  ]);
  return (
    <article
      ref={frameRef}
      className="interview-print-sheet overflow-hidden bg-white text-black"
      style={{ width: `${widthMm}mm`, height: `${heightMm}mm` }}
    >
      <div
        data-print-content
        className="box-border"
        style={{
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent:
            verticalAlign === "top"
              ? "flex-start"
              : verticalAlign === "bottom"
                ? "flex-end"
                : "center",
          height: "100%",
          fontSize: `${fontPt}pt`,
          textAlign: align,
          padding: "12mm",
          overflowWrap: "anywhere",
        }}
      >
        <div data-print-copy style={{ flex: "0 0 auto" }}>
          {showNumber ? <div>Station {page.number}</div> : null}
          {showName ? <div>{page.name}</div> : null}
          <div className={promptType}>
            <InterviewDocument value={page.prompt as JSONContent} />
          </div>
        </div>
      </div>
    </article>
  );
}

function ScaledSheet({
  widthMm,
  heightMm,
  children,
}: {
  widthMm: number;
  heightMm: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.45);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => {
      const pagePx = (widthMm * 96) / 25.4;
      const available = node.clientWidth;
      setScale(available > 0 ? Math.min(1, available / pagePx) : 0.45);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [widthMm]);
  const widthPx = ((widthMm * 96) / 25.4) * scale;
  const heightPx = ((heightMm * 96) / 25.4) * scale;
  return (
    <div ref={ref} className="w-full">
      <div className="mx-auto shadow-md" style={{ width: widthPx, height: heightPx }}>
        <div
          style={{
            width: `${widthMm}mm`,
            height: `${heightMm}mm`,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function InterviewPrintDialog({
  interview,
  catalog,
  onClose,
}: {
  interview: InterviewTemplate | null;
  catalog: InterviewCatalog;
  onClose: () => void;
}) {
  const [textSize, setTextSize] = useState(30);
  const [fitToPage, setFitToPage] = useState(false);
  const [align, setAlign] = useState<Align>("center");
  const [verticalAlign, setVerticalAlign] = useState<VerticalAlign>("middle");
  const [showNumber, setShowNumber] = useState(true);
  const [showName, setShowName] = useState(false);
  const [orientation, setOrientation] = useState<Orientation>("landscape");
  const [fitted, setFitted] = useState<Record<string, number>>({});
  const pages = interview ? pagesFor(interview, catalog) : [];
  const box = pageBox(orientation);
  const onFitted = (placementId: string, size: number) => {
    setFitted((current) =>
      current[placementId] != null && Math.abs(current[placementId] - size) < 0.4
        ? current
        : { ...current, [placementId]: size },
    );
  };
  const fontFor = (page: PrintPage) =>
    fitToPage ? (fitted[page.placementId] ?? textSize) : textSize;
  const sheet = (page: PrintPage, measure: boolean) => (
    <PromptSheet
      key={page.placementId}
      page={page}
      fontPt={fontFor(page)}
      align={align}
      verticalAlign={verticalAlign}
      showNumber={showNumber}
      showName={showName}
      widthMm={box.widthMm}
      heightMm={box.heightMm}
      measure={measure}
      onFitted={onFitted}
    />
  );
  return (
    <UcatDialogShell
      open={!!interview}
      onClose={onClose}
      title="Print prompts"
      subtitle={interview?.name || "Interview prompts"}
      onSave={() => window.print()}
      saveLabel="Print"
      saveDisabled={!pages.length}
      hideCancel={false}
      defaultExpanded
    >
      <div className="flex h-full min-h-0">
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-muted/40 p-6">
          {pages.length ? (
            <div className="mx-auto flex max-w-3xl flex-col gap-6">
              {pages.map((page) => (
                <ScaledSheet
                  key={page.placementId}
                  widthMm={box.widthMm}
                  heightMm={box.heightMm}
                >
                  {sheet(page, false)}
                </ScaledSheet>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              This interview has no stations to print.
            </p>
          )}
        </div>
        <aside className="w-80 shrink-0 space-y-5 overflow-y-auto border-l p-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium" htmlFor="print-text-size">
              Text size
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="print-text-size"
                type="number"
                min={8}
                max={200}
                disabled={fitToPage}
                value={textSize}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value)) {
                    setTextSize(Math.min(200, Math.max(8, value)));
                  }
                }}
              />
              <span className="text-sm text-muted-foreground">pt</span>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={fitToPage}
                onCheckedChange={(value) => setFitToPage(value === true)}
              />
              Fit to page
            </label>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Justify</div>
            <SegmentedControl
              fullWidth
              aria-label="Justify"
              value={align}
              onValueChange={setAlign}
              options={[
                { value: "left", label: "Left" },
                { value: "center", label: "Centre" },
                { value: "right", label: "Right" },
              ]}
            />
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Vertical</div>
            <SegmentedControl
              fullWidth
              aria-label="Vertical justification"
              value={verticalAlign}
              onValueChange={setVerticalAlign}
              options={[
                { value: "top", label: "Top" },
                { value: "middle", label: "Middle" },
                { value: "bottom", label: "Bottom" },
              ]}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={showNumber}
              onCheckedChange={(value) => setShowNumber(value === true)}
            />
            Include station number
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={showName}
              onCheckedChange={(value) => setShowName(value === true)}
            />
            Include station name
          </label>
          <div className="space-y-2">
            <div className="text-sm font-medium">Orientation</div>
            <SegmentedControl
              fullWidth
              aria-label="Orientation"
              value={orientation}
              onValueChange={setOrientation}
              options={[
                { value: "landscape", label: "Landscape" },
                { value: "portrait", label: "Portrait" },
              ]}
            />
          </div>
        </aside>
      </div>
      {interview && typeof document !== "undefined"
        ? createPortal(
            <div id="interview-print-mount" className="pointer-events-none absolute left-[-10000px] top-0">
              <style>
                {`@page { size: ${box.size}; margin: 0; }
@media print {
  body > *:not(#interview-print-mount) { display: none !important; }
  #interview-print-mount {
    display: block !important;
    position: static !important;
    left: auto !important;
    width: auto !important;
    height: auto !important;
    overflow: visible !important;
  }
  .interview-print-sheet { break-after: page; page-break-after: always; }
  .interview-print-sheet:last-child { break-after: auto; page-break-after: auto; }
}`}
              </style>
              {pages.map((page) => sheet(page, fitToPage))}
            </div>,
            document.body,
          )
        : null}
    </UcatDialogShell>
  );
}
