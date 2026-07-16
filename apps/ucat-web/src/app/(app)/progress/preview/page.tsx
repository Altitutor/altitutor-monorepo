import { notFound } from "next/navigation";
import { ProgressPreviewPage } from "@/features/progress/components/progress-preview-page";

export default function ProgressPreviewRoute() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <ProgressPreviewPage />;
}
