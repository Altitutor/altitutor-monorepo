"use client";
import { DocumentsView } from "@/features/notes/components/DocumentsView";
import { ListSettingsMenu } from "@/shared/components/ListSettingsMenu";
export default function DocumentsPage() {
  return (
    <>
      <ListSettingsMenu list="documents" />
      <DocumentsView />
    </>
  );
}
