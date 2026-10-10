"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePaneNavigation } from "@/shared/hooks/usePaneNavigation";
import { useAccessoryPanelActions } from "./AccessoryPanelContext";
import {
  FilePreviewModal,
  GenericFilePreviewModal,
} from "@/features/topics/components";
import { accessoryDestination } from "@/shared/hooks/usePaneNavigation";
import { ownedPrimaryHref } from "@/shared/utils/primaryOwnership";
import { useAccessoryTab } from "./AccessoryTabContext";
export type EntityType =
  | "student"
  | "parent"
  | "staff"
  | "class"
  | "session"
  | "invoice"
  | "subject"
  | "topic"
  | "admin-shift"
  | "file"
  | "file-preview"
  | "issue"
  | "task"
  | "project"
  | "note";
type OpenOptions = { defaultTab?: string };
interface EntityNavigationType {
  openEntity: (type: EntityType, id: string, options?: OpenOptions) => void;
  openStudent: (studentId: string) => void;
  openParent: (parentId: string, options?: OpenOptions) => void;
  openStaff: (staffId: string, options?: OpenOptions) => void;
  openClass: (classId: string) => void;
  openSession: (sessionId: string) => void;
  openInvoice: (invoiceId: string) => void;
  openSubject: (subjectId: string) => void;
  openTopic: (topicId: string) => void;
  openAdminShift: (adminShiftId: string) => void;
  openFile: (topicFileId: string) => void;
  openFilePreview: (fileId: string) => void;
  openIssue: (issueId: string) => void;
  openTask: (taskId: string) => void;
  openProject: (projectId: string) => void;
  openNote: (noteId: string) => void;
  collapseAccessory: () => void;
}
const primaryRoutes: Record<string, string> = {
  student: "students",
  parent: "parents",
  staff: "staff",
  class: "classes",
  session: "sessions",
  invoice: "invoices",
  subject: "subjects",
  topic: "topics",
  "admin-shift": "admin-shifts",
};
export function useEntityNavigation(): EntityNavigationType {
  const { router } = usePaneNavigation();
  const panel = useAccessoryPanelActions();
  const scope = useAccessoryTab();
  const openTab = scope?.navigate ?? panel?.openTab;
  const collapse = panel?.collapse;
  const openEntity = useCallback(
    (type: EntityType, id: string, options?: OpenOptions) => {
      const primary = primaryRoutes[type];
      if (primary) {
        if (
          document.getElementById("admin-accessory-panel")?.dataset.docked ===
          "false"
        )
          collapse?.();
        router.push(
          `/${primary}/${id}${options?.defaultTab ? `?tab=${encodeURIComponent(options.defaultTab)}` : ""}`,
        );
        return;
      }
      if (type === "file" || type === "file-preview") {
        window.dispatchEvent(
          new CustomEvent("entity-file-preview", { detail: { type, id } }),
        );
        return;
      }
      const route = type === "note" ? "documents" : `${type}s`;
      const destination = accessoryDestination(`/${route}/${id}`);
      if (destination) openTab?.(destination);
    },
    [router, openTab, collapse],
  );
  return useMemo(
    () => ({
      openEntity,
      openStudent: (id: string) => openEntity("student", id),
      openParent: (id: string, options?: OpenOptions) =>
        openEntity("parent", id, options),
      openStaff: (id: string, options?: OpenOptions) =>
        openEntity("staff", id, options),
      openClass: (id: string) => openEntity("class", id),
      openSession: (id: string) => openEntity("session", id),
      openInvoice: (id: string) => openEntity("invoice", id),
      openSubject: (id: string) => openEntity("subject", id),
      openTopic: (id: string) => openEntity("topic", id),
      openAdminShift: (id: string) => openEntity("admin-shift", id),
      openFile: (id: string) => openEntity("file", id),
      openFilePreview: (id: string) => openEntity("file-preview", id),
      openIssue: (id: string) => openEntity("issue", id),
      openTask: (id: string) => openEntity("task", id),
      openProject: (id: string) => openEntity("project", id),
      openNote: (id: string) => openEntity("note", id),
      collapseAccessory: () => collapse?.(),
    }),
    [openEntity, collapse],
  );
}
function getEntityTypeFromEventName(eventName: string): EntityType | null {
  switch (eventName) {
    case "open-student-modal":
      return "student";
    case "open-parent-modal":
      return "parent";
    case "open-staff-modal":
      return "staff";
    case "open-class-modal":
      return "class";
    case "open-session-modal":
      return "session";
    case "open-invoice-modal":
      return "invoice";
    case "open-subject-modal":
      return "subject";
    case "open-topic-modal":
      return "topic";
    case "open-admin-shift-modal":
      return "admin-shift";
    case "open-file-preview":
      return "file-preview";
    default:
      return null;
  }
}
export function EntityNavigationEvents({ children }: { children: ReactNode }) {
  const { openEntity } = useEntityNavigation();
  const { router } = usePaneNavigation();
  const panel = useAccessoryPanelActions();
  const openTab = panel?.openTab;
  const collapse = panel?.collapse;
  const [file, setFile] = useState<{
    type: "file" | "file-preview";
    id: string;
  } | null>(null);
  useEffect(() => {
    const handle = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      if (event.type === "open-accessory-messages") {
        const detail = event.detail as {
          conversationId?: string;
          title?: string;
        };
        if (detail.conversationId)
          openTab?.({
            kind: "messages",
            id: detail.conversationId,
            title: detail.title ?? "Messages",
            query: `conversation=${encodeURIComponent(detail.conversationId)}`,
          });
        return;
      }
      const { id, type } = (event.detail ?? {}) as {
        id?: unknown;
        type?: unknown;
      };
      if (typeof id !== "string") return;
      if (event.type === "entity-file-preview") {
        if (type === "file" || type === "file-preview") setFile({ type, id });
        return;
      }
      const entity =
        event.type === "mentionClick"
          ? type
          : getEntityTypeFromEventName(event.type);
      if (typeof entity === "string") {
        const route = entity === "note" ? "documents" : `${entity}s`;
        const destination = accessoryDestination(`/${route}/${id}`);
        const focused =
          (event.target instanceof Element
            ? event.target.closest("[data-accessory-tab]")
            : null) ?? document.activeElement?.closest("[data-accessory-tab]");
        if (destination && focused)
          focused.dispatchEvent(
            new CustomEvent("accessory-navigate", { detail: destination }),
          );
        else openEntity(entity as EntityType, id);
      }
    };
    const anchorNavigation = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor = (event.target as Element).closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (!anchor || anchor.target || anchor.origin !== window.location.origin)
        return;
      const destination = accessoryDestination(anchor.href);
      if (!destination) {
        if (!anchor.closest("[data-accessory-tab]")) {
          const href = anchor.pathname + anchor.search;
          const nested = ownedPrimaryHref(
            href,
            window.location.pathname,
            new URLSearchParams(window.location.search),
          );
          if (nested !== href) {
            event.preventDefault();
            router.push(nested);
            return;
          }
        }
        if (
          document.getElementById("admin-accessory-panel")?.dataset.docked ===
          "false"
        )
          collapse?.();
        return;
      }
      if (!openTab) return;
      event.preventDefault();
      const content = anchor.closest("[data-accessory-tab]");
      if (content)
        content.dispatchEvent(
          new CustomEvent("accessory-navigate", { detail: destination }),
        );
      else openTab(destination);
    };
    document.addEventListener("click", anchorNavigation, true);
    const names = [
      "open-accessory-messages",
      "mentionClick",
      "entity-file-preview",
      "open-student-modal",
      "open-parent-modal",
      "open-staff-modal",
      "open-class-modal",
      "open-session-modal",
      "open-invoice-modal",
      "open-subject-modal",
      "open-topic-modal",
      "open-admin-shift-modal",
      "open-file-preview",
    ];
    names.forEach((name) => window.addEventListener(name, handle));
    return () => {
      document.removeEventListener("click", anchorNavigation, true);
      names.forEach((name) => window.removeEventListener(name, handle));
    };
  }, [openEntity, openTab, collapse, router]);
  return (
    <>
      {children}
      {file?.type === "file" ? (
        <FilePreviewModal
          isOpen
          topicFileId={file.id}
          onClose={() => setFile(null)}
        />
      ) : file ? (
        <GenericFilePreviewModal
          isOpen
          fileId={file.id}
          onClose={() => setFile(null)}
        />
      ) : null}
    </>
  );
}
