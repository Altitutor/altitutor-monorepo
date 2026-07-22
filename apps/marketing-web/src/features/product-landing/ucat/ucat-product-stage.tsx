"use client";

import Image from "next/image";
import { useState } from "react";
import { SegmentedControl } from "@altitutor/ui";
import { UcatSimulatorPreview } from "./ucat-simulator-preview";

const galleryItems = [
  { id: "progress", label: "Progress" },
  { id: "study-plan", label: "Study plan" },
  { id: "simulator", label: "UCAT simulator" },
  { id: "review", label: "Attempt review" },
  { id: "learning", label: "Guided learning" },
] as const;

type GalleryItemId = (typeof galleryItems)[number]["id"];

const captures: Record<
  Exclude<GalleryItemId, "simulator">,
  { src: string; width: number; height: number; alt: string }
> = {
  progress: {
    src: "/assets/ucat/product-previews/progress.webp",
    width: 1429,
    height: 1280,
    alt: "Altitutor UCAT progress page with score history, projection, score insight, review activity, section scores and question completion",
  },
  "study-plan": {
    src: "/assets/ucat/product-previews/study-plan.webp",
    width: 1429,
    height: 1103,
    alt: "Altitutor UCAT study plan with a colour-coded calendar, target score, test date and the selected day's tasks",
  },
  review: {
    src: "/assets/ucat/product-previews/attempt-review.webp",
    width: 1429,
    height: 1802,
    alt: "Altitutor UCAT attempt review with the timing graph, a Decision Making question and its answer explanation",
  },
  learning: {
    src: "/assets/ucat/product-previews/guided-learning.webp",
    width: 1248,
    height: 900,
    alt: "Altitutor UCAT guided learning lesson with teaching, lesson progress and an embedded practice question",
  },
};

function ProductCapture({
  activeItem,
}: {
  activeItem: Exclude<GalleryItemId, "simulator">;
}) {
  const capture = captures[activeItem];

  return (
    <div className="h-full overflow-auto bg-[#f6f7f9] [scrollbar-color:rgba(10,41,65,0.35)_transparent] [scrollbar-width:thin]">
      <Image
        src={capture.src}
        width={capture.width}
        height={capture.height}
        alt={capture.alt}
        sizes="(min-width: 1536px) 1472px, (min-width: 768px) calc(100vw - 48px), 992px"
        priority={activeItem === "progress"}
        className="h-auto min-w-[62rem] max-w-none sm:min-w-full sm:max-w-full"
        style={{ height: "auto" }}
      />
    </div>
  );
}

function GalleryPreview({ activeItem }: { activeItem: GalleryItemId }) {
  if (activeItem === "simulator") return <UcatSimulatorPreview />;
  return <ProductCapture activeItem={activeItem} />;
}

export function UcatProductStage() {
  const [activeItem, setActiveItem] = useState<GalleryItemId>("progress");

  return (
    <section
      id="product"
      className="relative scroll-mt-24 overflow-hidden bg-marketing-primary px-3 pb-20 text-white sm:px-6 sm:pb-24"
    >
      <div className="pointer-events-none absolute -left-32 top-0 size-[32rem] rounded-full bg-[#355d72] blur-[130px]" />
      <div className="pointer-events-none absolute -right-24 bottom-0 size-[28rem] rounded-full bg-marketing-accent/18 blur-[120px]" />

      <div className="relative z-20 mx-auto -mt-px w-fit max-w-[calc(100%-0.5rem)] rounded-b-[2rem] bg-marketing-cream px-3 pb-5 pt-1 shadow-[0_18px_34px_rgba(0,0,0,0.12)] sm:rounded-b-[2.5rem] sm:px-6 sm:pb-6">
        <SegmentedControl
          value={activeItem}
          onValueChange={setActiveItem}
          options={galleryItems.map((item) => ({
            value: item.id,
            label: item.label,
          }))}
          variant="light"
          aria-label="Explore Altitutor UCAT"
          className="max-w-full [--radius:9999px]"
        />
      </div>

      <div className="relative mx-auto mt-7 w-full max-w-[92rem] sm:mt-9">
        <div
          role="tabpanel"
          aria-label={
            galleryItems.find((item) => item.id === activeItem)?.label
          }
          className="h-[35rem] overflow-hidden rounded-[1.25rem] bg-white shadow-[0_28px_90px_rgba(0,0,0,0.26)] ring-1 ring-white/15 sm:h-[42rem] lg:h-[46rem] xl:h-[50rem]"
        >
          <div
            key={activeItem}
            className="h-full min-h-0 animate-in fade-in slide-in-from-bottom-2 duration-300"
          >
            <GalleryPreview activeItem={activeItem} />
          </div>
        </div>
      </div>
    </section>
  );
}
