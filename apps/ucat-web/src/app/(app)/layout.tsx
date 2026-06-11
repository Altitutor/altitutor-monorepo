import type React from "react";
import { AppShell } from "@/features/layout";
import { UcatAccessShell } from "@/features/ucat-access/components/ucat-access-shell";

type AuthenticatedLayoutProps = {
  children?: React.ReactNode;
};

export default function AuthenticatedLayout({
  children,
}: AuthenticatedLayoutProps) {
  return (
    <UcatAccessShell>
      <AppShell>{children}</AppShell>
    </UcatAccessShell>
  );
}
