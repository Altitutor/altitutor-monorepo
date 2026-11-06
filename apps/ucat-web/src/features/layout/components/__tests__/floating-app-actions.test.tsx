import { fireEvent, render, screen } from "@testing-library/react";
import { FloatingAppActions } from "@/features/layout/components/floating-app-actions";

jest.mock("@altitutor/ui", () => {
  const actual =
    jest.requireActual<typeof import("@altitutor/ui")>("@altitutor/ui");
  return {
    ...actual,
    useToast: () => ({ toast: jest.fn() }),
  };
});

jest.mock("next-themes", () => ({
  useTheme: () => ({
    resolvedTheme: "light",
    setTheme: jest.fn(),
  }),
}));

jest.mock("@/features/notifications", () => ({
  NotificationTray: () => <button type="button">Notifications</button>,
}));

jest.mock("@/features/layout/components/header-notification-pills", () => ({
  HeaderNotificationPills: () => <div>Pills</div>,
}));

jest.mock("@/features/layout/components/profile-dropdown", () => ({
  ProfileDropdown: () => <button type="button">Profile</button>,
}));

describe("FloatingAppActions fullscreen", () => {
  beforeEach(() => {
    Object.defineProperty(document, "fullscreenEnabled", {
      configurable: true,
      get: () => true,
    });
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => null,
    });
    document.documentElement.requestFullscreen = jest
      .fn()
      .mockResolvedValue(undefined);
    document.exitFullscreen = jest.fn().mockResolvedValue(undefined);
  });

  it("places fullscreen immediately before the theme toggle", () => {
    render(
      <FloatingAppActions
        onToggleNav={jest.fn()}
        isMenuOpen={false}
        isMobile={false}
      />,
    );

    const fullscreen = screen.getByRole("button", { name: "Full screen" });
    const theme = screen.getByRole("button", { name: "Toggle theme" });

    expect(
      fullscreen.compareDocumentPosition(theme) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(fullscreen.nextElementSibling).toBe(theme);
    fireEvent.click(fullscreen);
    expect(document.documentElement.requestFullscreen).toHaveBeenCalledTimes(1);
  });
});
