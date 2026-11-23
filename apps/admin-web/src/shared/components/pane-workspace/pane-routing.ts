export type PaneAction = "navigate" | "replace" | "open" | "back" | "close";
export type PaneRequest = { action: PaneAction; href?: string; source?: "primary" };
export const paneRequestEvent = "admin-pane-request";
export const paneCloseEvent = "admin-pane-before-navigation";
export const paneFrameAttribute = "data-admin-pane-frame";

export function paneHref(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return null;
  const url = new URL(value, "https://admin.invalid");
  if (url.origin !== "https://admin.invalid" || !/^\/[a-z][a-z0-9-]*(?:\/|$)/.test(url.pathname)) return null;
  if (/^\/(api|login|logout|auth|forgot-password|reset-password)(\/|$)/.test(url.pathname)) return null;
  url.searchParams.delete("pane");
  url.searchParams.delete("activePane");
  url.searchParams.delete("hidePrimaryPane");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function requestPane(action: PaneAction, href?: string, source?: "primary") {
  if (typeof window === "undefined") return false;
  return !window.dispatchEvent(
    new CustomEvent<PaneRequest>(paneRequestEvent, { cancelable: true, detail: { action, href, source } }),
  );
}

const paths: Record<string, string> = {
  student: "students", parent: "parents", staff: "staff", class: "classes",
  session: "sessions", invoice: "invoices", subject: "subjects", topic: "topics",
  "admin-shift": "admin-shifts", adminShift: "admin-shifts",
  issue: "issues", task: "tasks", project: "projects", note: "documents",
  document: "documents",
};

export function openReferenceInPane(type: string, id: string, href?: string) {
  if (href && requestPane("open", href)) return true;
  const root = paths[type];
  if (root) return requestPane("open", `/${root}/${encodeURIComponent(id)}`);
  if (!["message", "email", "tutor-log", "tutorLog"].includes(type)) return false;
  void fetch(`/api/entity-references/${encodeURIComponent(type)}/${encodeURIComponent(id)}`)
    .then(async (response) => {
      if (!response.ok) return;
      const details = await response.json() as {
        href?: string;
        destination?: { kind: string; id: string; query?: string };
      };
      const target = details.destination;
      const route = details.href ?? (target?.kind === "messages"
        ? `/messages?${target.query ?? new URLSearchParams({ contact: target.id })}`
        : target?.kind === "email" ? `/email/${encodeURIComponent(target.id)}` : undefined);
      if (route) requestPane("open", route);
    })
    .catch(() => undefined);
  return true;
}

export function withPaneCloseGate(run: () => void) {
  const event = new CustomEvent(paneCloseEvent, { cancelable: true, detail: run });
  if (window.dispatchEvent(event)) run();
}
