import { navItems } from "../CommandPalette";
import { extractPagesFromNavItems } from "../../config/commandPalette.config";
import { accessoryDestination } from "@/shared/hooks/usePaneNavigation";

it("offers Issues as a searchable page that opens in the main content area", () => {
  const page = extractPagesFromNavItems(navItems).find(
    (item) => item.title === "Issues",
  );
  expect(page).toBeDefined();
  expect(accessoryDestination(page!.href)).toBeNull();
});
