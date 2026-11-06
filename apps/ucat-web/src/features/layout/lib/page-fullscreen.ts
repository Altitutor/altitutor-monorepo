export const PAGE_FULLSCREEN_FAILURE_TITLE = "Unable to enter fullscreen";

export const PAGE_FULLSCREEN_FAILURE_DESCRIPTION =
  "Your browser could not enter fullscreen. You can continue in this window.";

export type PageFullscreenTarget = {
  fullscreenEnabled?: boolean;
  fullscreenElement?: Element | null;
  documentElement: {
    requestFullscreen?: () => Promise<void>;
  };
  exitFullscreen?: () => Promise<void>;
};

export function canUsePageFullscreen(target: PageFullscreenTarget): boolean {
  return (
    target.fullscreenEnabled !== false &&
    typeof target.documentElement.requestFullscreen === "function"
  );
}

export function pageFullscreenLabel(
  active: boolean,
): "Full screen" | "Exit fullscreen" {
  return active ? "Exit fullscreen" : "Full screen";
}

export async function togglePageFullscreen(
  target: PageFullscreenTarget,
): Promise<"entered" | "exited" | "failed"> {
  if (!canUsePageFullscreen(target)) return "failed";

  try {
    if (target.fullscreenElement) {
      if (!target.exitFullscreen) return "failed";
      await target.exitFullscreen();
      return "exited";
    }

    const requestFullscreen = target.documentElement.requestFullscreen;
    if (!requestFullscreen) return "failed";
    await requestFullscreen.call(target.documentElement);
    return "entered";
  } catch {
    return "failed";
  }
}
