import { notFound } from "next/navigation";
import { DashboardPreviewPage } from "@/features/dashboard/components/dashboard-preview-page";

export default function DashboardPreviewRoute() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <DashboardPreviewPage />;
}
