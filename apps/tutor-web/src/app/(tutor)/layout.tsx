import { redirect } from "next/navigation";
import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import { PortalAccessUnavailable } from "@/features/auth/components/PortalAccessUnavailable";
import { loadTutorPortalAccess } from "@/features/auth/server/portal-access";
import TutorClientLayout from "./client-layout";

export default async function TutorLayout({ children }: { children: React.ReactNode }) {
  const access = await loadTutorPortalAccess();

  if (access.status === "unauthenticated") redirect("/login");
  if (access.status === "denied") redirect("/login?error=access_denied");
  if (access.status === "unavailable") return <PortalAccessUnavailable />;

  const queryClient = new QueryClient();
  queryClient.setQueryData(["staff", "current", access.userId], access.profile);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TutorClientLayout>{children}</TutorClientLayout>
    </HydrationBoundary>
  );
}
