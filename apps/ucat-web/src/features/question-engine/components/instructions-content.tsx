"use client";

import { RichTextEditor } from "@altitutor/ui";
import { UCAT_FONTS } from "@altitutor/ui/components/ucat/ucat-theme";
import type { InstructionsScreen } from "@/features/question-engine/model/types";
import { useRefreshedUcatContent } from "@/features/question-engine/hooks/use-refreshed-ucat-content";

export function InstructionsContent({
  screen,
}: {
  screen: InstructionsScreen;
}) {
  const json =
    screen.instructionsJson ??
    ({
      type: "doc",
      content: [{ type: "paragraph" }],
    } as Record<string, unknown>);

  const { content, hasImageRefs } = useRefreshedUcatContent(json);
  const waitingForImageRefresh = hasImageRefs && content == null;
  const displayContent = content ?? json;

  return (
    <div
      className={`h-full overflow-auto font-[${UCAT_FONTS.body}] text-[11pt] leading-relaxed text-black dark:text-black`}
      data-testid="instructions-content"
    >
      <div className="py-4 sm:py-5">
        {waitingForImageRefresh ? (
          <div
            className="min-h-[200px] animate-pulse rounded bg-muted/40"
            aria-busy="true"
            aria-label="Loading instructions"
          />
        ) : (
          <RichTextEditor
            content={displayContent}
            editable={false}
            omitTypography
            minHeight="auto"
            className="min-h-0 text-black dark:text-black [&_.ProseMirror]:min-h-[200px] [&_.ProseMirror]:!text-black [&_.ProseMirror]:dark:!text-black"
          />
        )}
      </div>
    </div>
  );
}
