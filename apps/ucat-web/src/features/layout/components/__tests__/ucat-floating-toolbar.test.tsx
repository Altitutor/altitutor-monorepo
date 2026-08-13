import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { UcatFloatingToolbar } from "@/features/layout/components/ucat-floating-toolbar";

const updatePreferences = jest.fn();
const setTutorialToolbarVisible = jest.fn();
let pathname = "/exam";

jest.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

jest.mock("@/shared/hooks/use-media-query", () => ({
  useMediaQuery: () => false,
}));

jest.mock(
  "@/features/interface-preferences/hooks/use-ucat-interface-preferences",
  () => ({
    useUcatInterfacePreferences: () => ({
      preferences: {
        examToolbarVisible: true,
        examToolbarLayout: "compact_top",
      },
      updatePreferences,
    }),
  }),
);

describe("UcatFloatingToolbar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pathname = "/exam";
  });

  it("uses the pill itself to hide the toolbar", () => {
    render(<UcatFloatingToolbar />);

    fireEvent.click(screen.getByRole("button", { name: "Hide toolbar" }));

    expect(updatePreferences).toHaveBeenCalledWith({
      examToolbarVisible: false,
    });
    expect(screen.queryByRole("button", { name: "Exit session" })).toBeNull();
  });

  it("starts the tutorial toolbar closed and lets the menu open it", () => {
    pathname = "/exam/tutorial";
    render(
      <UcatFloatingToolbar
        {...({
          tutorialToolbarVisible: false,
          onTutorialToolbarVisibleChange: setTutorialToolbarVisible,
        } as React.ComponentProps<typeof UcatFloatingToolbar>)}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Show toolbar" }));

    expect(setTutorialToolbarVisible).toHaveBeenCalledWith(true);
    expect(updatePreferences).not.toHaveBeenCalled();
  });

  it("follows the tutorial toolbar when it moves to the right", () => {
    pathname = "/exam/tutorial";
    render(
      <UcatFloatingToolbar
        tutorialToolbarVisible
        tutorialToolbarLayout="detailed_right"
        onTutorialToolbarVisibleChange={setTutorialToolbarVisible}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Hide toolbar" }).parentElement
        ?.parentElement,
    ).toHaveClass("right-64");
  });
});
