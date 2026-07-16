import { notFound } from "next/navigation";
import { AttemptPreviewPage } from "@/features/progress/components/attempt-preview-page";

export default function AttemptPreviewRoute() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <AttemptPreviewPage />;
}
