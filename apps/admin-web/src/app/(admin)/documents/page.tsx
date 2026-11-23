"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { AdminPageActions } from "@/shared/components/AdminPageActions";
import { AdminPageActionButton } from "@/shared/components/admin-page-action-button";
import { NewDocumentDialog } from "@/shared/shortcuts/NewDocumentDialog";
import { DocumentsView } from "@/features/notes/components/DocumentsView";
import { ListSettingsMenu } from "@/shared/components/ListSettingsMenu";
export default function DocumentsPage() {
  const [adding, setAdding] = useState(false);
  return (
    <>
      <ListSettingsMenu list="documents" />
      <AdminPageActions>
        <AdminPageActionButton icon={<Plus />} createShortcut label="Add document" onClick={() => setAdding(true)} />
      </AdminPageActions>
      <DocumentsView />
      {adding && <NewDocumentDialog open onClose={() => setAdding(false)} />}
    </>
  );
}
