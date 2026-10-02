import { navItems } from "../CommandPalette";
import { extractPagesFromNavItems } from "../../config/commandPalette.config";
import { accessoryDestination } from "@/shared/hooks/usePaneNavigation";

it("offers Issues as a searchable page that opens the right panel", () => {
  const page = extractPagesFromNavItems(navItems).find(
    (item) => item.title === "Issues",
  );
  expect(page).toBeDefined();
  expect(accessoryDestination(page!.href)).toMatchObject({ kind: "issues" });
});
