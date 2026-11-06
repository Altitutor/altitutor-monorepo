import {
  canUsePageFullscreen,
  pageFullscreenLabel,
  togglePageFullscreen,
  type PageFullscreenTarget,
} from "@/features/layout/lib/page-fullscreen";

function target(
  overrides: Partial<PageFullscreenTarget> = {},
): PageFullscreenTarget {
  return {
    fullscreenEnabled: true,
    fullscreenElement: null,
    documentElement: {
      requestFullscreen: jest.fn().mockResolvedValue(undefined),
    },
    exitFullscreen: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("page fullscreen", () => {
  it("hides the control when the browser cannot fullscreen a page", () => {
    expect(canUsePageFullscreen(target({ fullscreenEnabled: false }))).toBe(
      false,
    );
    expect(
      canUsePageFullscreen(
        target({
          documentElement: {},
        }),
      ),
    ).toBe(false);
  });

  it("offers the control when the browser can fullscreen a page", () => {
    expect(canUsePageFullscreen(target())).toBe(true);
  });

  it("names the control for the current fullscreen state", () => {
    expect(pageFullscreenLabel(false)).toBe("Full screen");
    expect(pageFullscreenLabel(true)).toBe("Exit fullscreen");
  });

  it("enters fullscreen for the whole page", async () => {
    const page = target();
    const element = page.documentElement;
    element.requestFullscreen = jest.fn(function (this: unknown) {
      expect(this).toBe(element);
      return Promise.resolve();
    });

    await expect(togglePageFullscreen(page)).resolves.toBe("entered");

    expect(element.requestFullscreen).toHaveBeenCalledTimes(1);
    expect(page.exitFullscreen).not.toHaveBeenCalled();
  });

  it("leaves fullscreen without changing the page", async () => {
    const page = target({ fullscreenElement: document.documentElement });

    await expect(togglePageFullscreen(page)).resolves.toBe("exited");

    expect(page.exitFullscreen).toHaveBeenCalledTimes(1);
    expect(page.documentElement.requestFullscreen).not.toHaveBeenCalled();
  });

  it("reports a refused request without throwing", async () => {
    const page = target({
      documentElement: {
        requestFullscreen: jest.fn().mockRejectedValue(new Error("denied")),
      },
    });

    await expect(togglePageFullscreen(page)).resolves.toBe("failed");
  });
});
