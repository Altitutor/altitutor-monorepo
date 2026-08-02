import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { UcatFloatingToolbar } from "@/features/layout/components/ucat-floating-toolbar";

const requestExit = jest.fn();
const updatePreferences = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => "/exam",
}));

jest.mock("@/features/exam-experience/context/exam-experience-context", () => ({
  useExamExperience: () => ({ requestExit }),
}));

jest.mock(
  "@/features/interface-preferences/hooks/use-ucat-interface-preferences",
  () => ({
    useUcatInterfacePreferences: () => ({
      preferences: { examToolbarVisible: true },
      updatePreferences,
    }),
  }),
);

describe("UcatFloatingToolbar", () => {
  beforeEach(() => jest.clearAllMocks());

  it("keeps the pill menu limited to toolbar visibility and exit", () => {
    render(<UcatFloatingToolbar />);

    fireEvent.click(screen.getByRole("button", { name: "Session menu" }));

    expect(
      screen.getByRole("button", { name: "Hide toolbar" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Exit session" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Lag mode")).not.toBeInTheDocument();
    expect(screen.queryByText("Contact us")).not.toBeInTheDocument();
  });

  it("updates visibility and delegates exit to the shared shell", () => {
    render(<UcatFloatingToolbar />);
    fireEvent.click(screen.getByRole("button", { name: "Session menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide toolbar" }));
    expect(updatePreferences).toHaveBeenCalledWith({
      examToolbarVisible: false,
    });

    fireEvent.click(screen.getByRole("button", { name: "Session menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Exit session" }));
    expect(requestExit).toHaveBeenCalledTimes(1);
  });
});
