/** Hidden preserved tabs and collapsed panels must never receive focus. */
export function visibleControl<T extends HTMLElement>(
  root: ParentNode,
  selector: string,
): T | undefined {
  return Array.from(root.querySelectorAll<T>(selector)).find(
    (node) =>
      !node.closest('[hidden], [inert], [aria-hidden="true"]') &&
      !node.matches(":disabled") &&
      node.getClientRects().length > 0,
  );
}
export function activeDialog() {
  return visibleControl<HTMLElement>(
    document,
    '[role="dialog"], [role="alertdialog"]',
  );
}
export function searchControl(activeKey?: string | null) {
  const root =
    activeDialog() ??
    (activeKey
      ? document.getElementById(`accessory-content-${activeKey}`)
      : null) ??
    document.querySelector("[data-admin-main]") ??
    document;
  return visibleControl<HTMLInputElement>(
    root,
    'input[type="search"], input[placeholder*="Search" i], input[placeholder*="Filter" i]',
  );
}
