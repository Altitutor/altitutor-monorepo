const HANDLE_ACTIVE_ATTR = 'data-resize-handle-active';
const BODY_ACTIVE_ATTR = 'data-panel-resize-active';
const RESIZE_COOLDOWN_MS = 200;
const MODAL_ROOT_SELECTOR = '[role="dialog"], [data-slot="dialog-content"], [data-slot="sheet-content"]';

let lastResizeEndedAt = 0;
let installed = false;
const boundReleaseHandles = new WeakSet<HTMLElement>();

function findSeparatorInEventPath(event: PointerEvent): HTMLElement | null {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  for (const node of path) {
    if (!(node instanceof Element)) continue;
    const separator = node.closest('[data-separator]');
    if (separator instanceof HTMLElement) return separator;
  }

  const target = event.target;
  if (target instanceof Element) {
    const separator = target.closest('[data-separator]');
    if (separator instanceof HTMLElement) return separator;
  }

  return null;
}

function isSeparatorInsideModal(separator: HTMLElement): boolean {
  return Boolean(separator.closest(MODAL_ROOT_SELECTOR));
}

function onDocumentPointerDownCapture(event: PointerEvent): void {
  const separator = findSeparatorInEventPath(event);
  if (!separator || !isSeparatorInsideModal(separator)) return;

  markPanelResizeActive(separator);
  bindPanelResizeRelease(separator);
}

/** Must run on the client; SSR module init cannot attach document listeners. */
export function ensurePanelResizeGuardInstalled(): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener('pointerdown', onDocumentPointerDownCapture, true);
}

export function markPanelResizeActive(handle: HTMLElement): void {
  ensurePanelResizeGuardInstalled();
  handle.setAttribute(HANDLE_ACTIVE_ATTR, 'true');
  document.body.setAttribute(BODY_ACTIVE_ATTR, 'true');
}

export function clearPanelResizeActive(handle: HTMLElement): void {
  handle.removeAttribute(HANDLE_ACTIVE_ATTR);
  if (!document.querySelector(`[${HANDLE_ACTIVE_ATTR}]`)) {
    document.body.removeAttribute(BODY_ACTIVE_ATTR);
    lastResizeEndedAt = Date.now();
  }
}

export function isPanelResizeActive(): boolean {
  if (typeof document === 'undefined') return false;
  if (document.body.hasAttribute(BODY_ACTIVE_ATTR)) return true;
  if (document.querySelector(`[${HANDLE_ACTIVE_ATTR}]`)) return true;
  return Date.now() - lastResizeEndedAt < RESIZE_COOLDOWN_MS;
}

export function bindPanelResizeRelease(handle: HTMLElement): void {
  if (boundReleaseHandles.has(handle)) return;
  boundReleaseHandles.add(handle);

  const release = () => {
    window.removeEventListener('pointerup', release, true);
    window.removeEventListener('pointercancel', release, true);
    boundReleaseHandles.delete(handle);
    // Defer clearing so Radix focus-outside / interact-outside handlers that run
    // synchronously after pointerup still see the active resize flag.
    window.requestAnimationFrame(() => {
      clearPanelResizeActive(handle);
    });
  };

  window.addEventListener('pointerup', release, true);
  window.addEventListener('pointercancel', release, true);
}
