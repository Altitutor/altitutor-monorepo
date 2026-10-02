"use client";

import type { ComponentProps } from "react";
import { ActivityFeed } from "./ActivityFeed";
import { ActivityNoteComposer } from "./ActivityNoteComposer";
import { useEntityActivityNoteComposer } from "../hooks/useEntityActivityNoteComposer";
import { activityKeys } from "../queryKeys";

type Props = Omit<ComponentProps<typeof ActivityFeed>, "chronological"> & {
  kind: "task" | "issue" | "project";
  entityId: string;
};
export function WorkItemActivity({ kind, entityId, ...feed }: Props) {
  const composer = useEntityActivityNoteComposer({
    targetType: `${kind}s`,
    targetId: entityId,
    activityQueryKey: activityKeys[kind](entityId),
  });
  return (
    <section className="space-y-4" aria-label="Activity">
      <h3 className="text-lg font-semibold">Activity</h3>
      <ActivityFeed {...feed} chronological />
      <ActivityNoteComposer {...composer} />
    </section>
  );
}
