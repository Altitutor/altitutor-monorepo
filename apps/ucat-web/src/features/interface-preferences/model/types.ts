export type ExamToolbarLayout = "compact_top" | "detailed_right";
export type InterfaceTheme = "light" | "dark" | "system";

export type UcatInterfacePreferences = {
  examToolbarLayout: ExamToolbarLayout;
  examToolbarVisible: boolean;
  lagModeEnabled: boolean;
  studySuggestionsVisible: boolean;
  theme: InterfaceTheme;
};

export const DEFAULT_UCAT_INTERFACE_PREFERENCES: UcatInterfacePreferences = {
  examToolbarLayout: "compact_top",
  examToolbarVisible: true,
  lagModeEnabled: false,
  studySuggestionsVisible: true,
  theme: "system",
};

export function parseUcatInterfacePreferences(
  value: unknown,
): UcatInterfacePreferences {
  const candidate =
    value != null && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const defaults = DEFAULT_UCAT_INTERFACE_PREFERENCES;

  return {
    examToolbarLayout:
      candidate.examToolbarLayout === "detailed_right" ||
      candidate.examToolbarLayout === "compact_top"
        ? candidate.examToolbarLayout
        : defaults.examToolbarLayout,
    examToolbarVisible:
      typeof candidate.examToolbarVisible === "boolean"
        ? candidate.examToolbarVisible
        : defaults.examToolbarVisible,
    lagModeEnabled:
      typeof candidate.lagModeEnabled === "boolean"
        ? candidate.lagModeEnabled
        : defaults.lagModeEnabled,
    studySuggestionsVisible:
      typeof candidate.studySuggestionsVisible === "boolean"
        ? candidate.studySuggestionsVisible
        : defaults.studySuggestionsVisible,
    theme:
      candidate.theme === "light" ||
      candidate.theme === "dark" ||
      candidate.theme === "system"
        ? candidate.theme
        : defaults.theme,
  };
}

export function parseUcatInterfacePreferencesPatch(
  value: unknown,
): Partial<UcatInterfacePreferences> | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  const allowedKeys = new Set<keyof UcatInterfacePreferences>([
    "examToolbarLayout",
    "examToolbarVisible",
    "lagModeEnabled",
    "studySuggestionsVisible",
    "theme",
  ]);
  if (
    Object.keys(candidate).some(
      (key) => !allowedKeys.has(key as keyof UcatInterfacePreferences),
    )
  ) {
    return null;
  }

  const patch: Partial<UcatInterfacePreferences> = {};
  if ("examToolbarLayout" in candidate) {
    if (
      candidate.examToolbarLayout !== "compact_top" &&
      candidate.examToolbarLayout !== "detailed_right"
    ) {
      return null;
    }
    patch.examToolbarLayout = candidate.examToolbarLayout;
  }
  for (const key of [
    "examToolbarVisible",
    "lagModeEnabled",
    "studySuggestionsVisible",
  ] as const) {
    if (key in candidate) {
      if (typeof candidate[key] !== "boolean") return null;
      patch[key] = candidate[key];
    }
  }
  if ("theme" in candidate) {
    if (
      candidate.theme !== "light" &&
      candidate.theme !== "dark" &&
      candidate.theme !== "system"
    ) {
      return null;
    }
    patch.theme = candidate.theme;
  }
  return patch;
}
