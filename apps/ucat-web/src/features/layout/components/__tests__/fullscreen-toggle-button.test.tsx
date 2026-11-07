import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TooltipProvider } from "@altitutor/ui";
import { FullscreenToggleButton } from "@/features/layout/components/fullscreen-toggle-button";

const toast = jest.fn();

jest.mock("@altitutor/ui", () => {
  const actual =
    jest.requireActual<typeof import("@altitutor/ui")>("@altitutor/ui");
  return {
    ...actual,
    useToast: () => ({ toast }),
  };
});

function installPageFullscreen(options?: {
  enabled?: boolean;
  request?: jest.Mock;
  active?: () => boolean;
}) {
  const request = options?.request ?? jest.fn().mockResolvedValue(undefined);
  const exit = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(document, "fullscreenEnabled", {
    configurable: true,
    get: () => options?.enabled ?? true,
  });
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    get: () => (options?.active?.() ? document.documentElement : null),
  });
  document.documentElement.requestFullscreen = request;
  document.exitFullscreen = exit;
  return { request, exit };
}

function renderButton(presentation: "icon" | "compact" | "detailed" = "icon") {
  return render(
    <TooltipProvider>
      <FullscreenToggleButton presentation={presentation} />
    </TooltipProvider>,
  );
}

describe("FullscreenToggleButton", () => {
  beforeEach(() => {
    toast.mockReset();
  });

  it("stays hidden when the browser cannot fullscreen a page", () => {
    installPageFullscreen({ enabled: false });

    renderButton();

    expect(screen.queryByRole("button", { name: "Full screen" })).toBeNull();
  });

  it("enters and leaves page fullscreen with the browser", async () => {
    let active = false;
    const { request, exit } = installPageFullscreen({
      active: () => active,
    });
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: "Full screen" }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));

    active = true;
    fireEvent(document, new Event("fullscreenchange"));
    fireEvent.click(screen.getByRole("button", { name: "Exit fullscreen" }));

    await waitFor(() => expect(exit).toHaveBeenCalledTimes(1));
    expect(toast).not.toHaveBeenCalled();
  });

  it("tells the student to continue when fullscreen is refused", async () => {
    installPageFullscreen({
      request: jest.fn().mockRejectedValue(new Error("denied")),
    });
    renderButton("detailed");

    fireEvent.click(screen.getByRole("button", { name: "Full screen" }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        title: "Unable to enter fullscreen",
        description:
          "Your browser could not enter fullscreen. You can continue in this window.",
      }),
    );
    expect(
      screen.getByRole("button", { name: "Full screen" }),
    ).toBeInTheDocument();
  });
});
