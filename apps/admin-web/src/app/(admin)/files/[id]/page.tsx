"use client";

import { use } from "react";
import { TopicFilePreviewModal } from "@/features/topics/components/TopicFilePreviewModal";
import { requestPane } from "@/shared/components/pane-workspace/pane-routing";
import { useEmbeddedPane } from "@/shared/components/pane-workspace/PaneWorkspace";
import { usePaneNavigation } from "@/shared/hooks/usePaneNavigation";

export default function TopicFilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const embedded = useEmbeddedPane();
  const { router } = usePaneNavigation();

  return (
    <TopicFilePreviewModal
      isOpen
      topicFileId={id}
      onClose={() => {
        if (embedded && requestPane("close")) return;
        router.replace("/subjects");
      }}
    />
  );
}
