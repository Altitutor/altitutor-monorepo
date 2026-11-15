// Temporary recurrence evidence. These are initial route options, not observed
// native state: dynamic screens can subsequently request a different detent set.
const initialDetents = {
  settings: "half_full",
  "study-orb": "half_full",
  "lesson-navigator": "half_full",
  "exam-start": "half_full",
  "lesson-start": "half_full",
  notifications: "half_full",
  calculator: "half_full",
  "exam-menu": "half",
  "trainer-start": "half_full",
  "question-navigator": "half_full",
  "trainer-menu": "half",
} as const;

type Phase =
  | "focus"
  | "blur"
  | "transition_start"
  | "transition_end"
  | "detent_change"
  | "request_full_height";
export type SheetBreadcrumb = {
  category: "ucat.sheet";
  level: "info";
  data: {
    schema: 1;
    route: keyof typeof initialDetents;
    initial_detents: "half" | "half_full";
    phase: Phase;
    closing?: boolean;
    index?: number;
    stable?: boolean;
    requested_detents?: "full";
  };
};

export function createAndroidSheetDiagnostics(
  platform: string | undefined,
  sentry: {
    getClient: () => { getOptions: () => { enabled?: boolean } } | undefined;
    addBreadcrumb: (breadcrumb: SheetBreadcrumb) => void;
  },
) {
  return createSheetDiagnostics(platform === "android", (breadcrumb) => {
    // Sentry can retain/forward breadcrumbs even with event collection disabled.
    // Consult its current client so disabled or absent telemetry stays untouched.
    const client = sentry.getClient();
    if (client && client.getOptions().enabled !== false)
      sentry.addBreadcrumb(breadcrumb);
  });
}

export function createSheetDiagnostics(
  enabled: boolean,
  capture: (breadcrumb: SheetBreadcrumb) => void,
) {
  function emit(
    route: string,
    phase: Phase,
    fields: Pick<
      SheetBreadcrumb["data"],
      "closing" | "index" | "stable" | "requested_detents"
    > = {},
  ) {
    if (!enabled || !Object.hasOwn(initialDetents, route)) return;
    const name = route as keyof typeof initialDetents;
    try {
      capture({
        category: "ucat.sheet",
        level: "info",
        data: {
          schema: 1,
          route: name,
          initial_detents: initialDetents[name],
          phase,
          ...fields,
        },
      });
    } catch {
      // Evidence capture must not interrupt navigation or the requested action.
    }
  }

  return {
    listeners(route: string) {
      return {
        focus: () => emit(route, "focus"),
        blur: () => emit(route, "blur"),
        transitionStart: ({ data }: { data: { closing: boolean } }) => {
          if (typeof data.closing === "boolean")
            emit(route, "transition_start", { closing: data.closing });
        },
        transitionEnd: ({ data }: { data: { closing: boolean } }) => {
          if (typeof data.closing === "boolean")
            emit(route, "transition_end", { closing: data.closing });
        },
        sheetDetentChange: ({
          data,
        }: {
          data: { index: number; stable: boolean };
        }) => {
          if (
            Number.isInteger(data.index) &&
            data.index >= -1 &&
            data.index <= 2 &&
            typeof data.stable === "boolean"
          )
            emit(route, "detent_change", {
              index: data.index,
              stable: data.stable,
            });
        },
      };
    },
    requestFullHeight(
      route: "study-orb" | "trainer-start",
      update: () => void,
    ) {
      // Capture intent before React changes options. The native fatal can occur
      // before screens emits the corresponding detent-change event to JS.
      emit(route, "request_full_height", { requested_detents: "full" });
      update();
    },
  };
}
