"use client";

import * as React from "react";
import "../styles/dialog-scope.css";

type DialogScopeValue = {
  container: HTMLDivElement | null;
  setContainer: (container: HTMLDivElement | null) => void;
  openCount: number;
  register: () => () => void;
};

const DialogScopeContext = React.createContext<DialogScopeValue | null>(null);

/** Share the main pane's dialog target with neighbouring accessory views. */
export function DialogScopeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [container, setContainer] = React.useState<HTMLDivElement | null>(null);
  const [openCount, setOpenCount] = React.useState(0);
  const register = React.useCallback(() => {
    setOpenCount((count) => count + 1);
    return () => setOpenCount((count) => count - 1);
  }, []);
  const scope = React.useMemo(
    () => ({ container, setContainer, openCount, register }),
    [container, openCount, register],
  );
  return (
    <DialogScopeContext.Provider value={scope}>
      {children}
    </DialogScopeContext.Provider>
  );
}

/** The pane to darken and block while a scoped dialog is open. */
export function DialogScopePane({ children }: { children: React.ReactNode }) {
  const scope = useDialogScope();
  const content = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    content.current?.toggleAttribute("inert", (scope?.openCount ?? 0) > 0);
  }, [scope?.openCount]);
  return (
    <div
      data-dialog-scope
      className="relative h-full min-h-0 min-w-0 overflow-hidden"
      style={{ transform: "translateZ(0)" }}
    >
      <div ref={content} className="h-full min-h-0">
        {children}
      </div>
      <div
        ref={scope?.setContainer}
        data-dialog-scope-portal
        className="pointer-events-none absolute inset-0 z-50"
      />
    </div>
  );
}

/** Keep dialogs inside a workspace pane while neighbouring panes remain usable. */
export function DialogScope({ children }: { children: React.ReactNode }) {
  return (
    <DialogScopeProvider>
      <DialogScopePane>{children}</DialogScopePane>
    </DialogScopeProvider>
  );
}

export function useDialogScope() {
  return React.useContext(DialogScopeContext);
}

export function useRegisterScopedDialog(
  scope: DialogScopeValue | null,
  mounted: boolean,
) {
  const register = scope?.register;
  React.useEffect(
    () => (mounted ? register?.() : undefined),
    [register, mounted],
  );
}
