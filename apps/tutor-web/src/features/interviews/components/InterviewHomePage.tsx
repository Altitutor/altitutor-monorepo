"use client";

import {
  Calendar,
  FileQuestion,
  FolderTree,
  Layers,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { ClickableNavCard } from "@altitutor/ui";
import { TutorPageContainer } from "@/shared/components/layouts";
import { tutorCardCn } from "@/shared/lib/tutor-visual";
import { InterviewPageHeader } from "./interview-page";

type InterviewNavCard = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

const sections: { heading: string; cards: InterviewNavCard[] }[] = [
  {
    heading: "Scheduling",
    cards: [
      {
        title: "Interview rounds",
        description: "Schedule rounds, edit setup, and open the waiting room",
        href: "/interviews/rounds",
        icon: Calendar,
      },
    ],
  },
  {
    heading: "Content",
    cards: [
      {
        title: "Interview bank",
        description: "Assemble whole stations and configure interview timing",
        href: "/interviews/bank",
        icon: Layers,
      },
      {
        title: "Station bank",
        description: "Create stations with shared prompts, linked questions, and rubrics",
        href: "/interviews/stations",
        icon: FileQuestion,
      },
    ],
  },
  {
    heading: "Settings",
    cards: [
      {
        title: "Station categories",
        description: "Organize stations into a category hierarchy",
        href: "/interviews/station-categories",
        icon: FolderTree,
      },
      {
        title: "Question tags",
        description: "Label individual station questions for filtering",
        href: "/interviews/question-tags",
        icon: Tag,
      },
    ],
  },
];

export function InterviewHomePage() {
  return (
    <TutorPageContainer className="space-y-8">
      <InterviewPageHeader
        title="Interviews"
        breadcrumbs={[{ label: "Interviews" }]}
      />
      <div className="space-y-8">
        {sections.map((section) => {
          const sectionId = `interviews-section-${section.heading.replace(/\s+/g, "-").toLowerCase()}`;
          return (
            <section key={section.heading} aria-labelledby={sectionId} className="space-y-4">
              <h2 id={sectionId} className="text-2xl font-semibold">
                {section.heading}
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {section.cards.map((card) => (
                  <li key={card.href} className="flex min-w-0 flex-col">
                    <ClickableNavCard
                      href={card.href}
                      icon={card.icon}
                      title={card.title}
                      description={card.description}
                      cardClassName={tutorCardCn()}
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </TutorPageContainer>
  );
}
