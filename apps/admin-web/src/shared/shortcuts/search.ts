/** Hidden preserved tabs and collapsed panels must never receive focus. */
export function visibleControl<T extends HTMLElement>(
  root: ParentNode,
  selector: string,
): T | undefined {
  return Array.from(root.querySelectorAll<T>(selector)).find(
    (node) =>
      !node.closest(
        '[hidden], [inert], [aria-hidden="true"], [data-state="closed"][role="dialog"], [data-state="closed"][role="menu"]',
      ) &&
      !node.matches(":disabled") &&
      node.getClientRects().length > 0,
  );
}
export function activeDialog() {
  return visibleControl<HTMLElement>(
    document,
    '[role="dialog"], [role="alertdialog"], [role="menu"]',
  );
}
function searchRoot(activeKey?: string | null) {
  return (
    activeDialog() ??
    document.activeElement?.closest<HTMLElement>(
      "[data-accessory-tab],[data-admin-main]",
    ) ??
    (activeKey
      ? document.getElementById(`accessory-content-${activeKey}`)
      : null) ??
    document.querySelector("[data-admin-main]") ??
    document
  );
}
export function searchControl(activeKey?: string | null) {
  return visibleControl<HTMLInputElement>(
    searchRoot(activeKey),
    'input[type="search"], input[placeholder*="Search" i], input[placeholder*="Filter" i]',
  );
}

export function searchTrigger(activeKey?: string | null) {
  return visibleControl<HTMLButtonElement>(
    searchRoot(activeKey),
    "button[data-shortcut-search]",
  );
}
