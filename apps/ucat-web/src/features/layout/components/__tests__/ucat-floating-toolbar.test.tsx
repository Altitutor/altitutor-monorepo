import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { UcatFloatingToolbar } from "@/features/layout/components/ucat-floating-toolbar";

const updatePreferences = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => "/exam",
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
  beforeEach(() => jest.clearAllMocks());

  it("uses the pill itself to hide the toolbar", () => {
    render(<UcatFloatingToolbar />);

    fireEvent.click(screen.getByRole("button", { name: "Hide toolbar" }));

    expect(updatePreferences).toHaveBeenCalledWith({
      examToolbarVisible: false,
    });
    expect(screen.queryByRole("button", { name: "Exit session" })).toBeNull();
  });
});
