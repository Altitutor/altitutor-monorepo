import { UCAT_SURFACE_MOTION } from "@/lib/ucat-surface-motion";

describe("UCAT_SURFACE_MOTION", () => {
  it("does not CSS-transition opacity or transform", () => {
    // Stagger items (study-plan tasks, set/mock details cards) animate those
    // properties with Motion. A CSS transition on the same properties makes the
    // first painted frame visible, then fades it out and back in — a second flash.
    expect(UCAT_SURFACE_MOTION).not.toMatch(/(?:^|\s|,)opacity(?:\s|,|$)/);
    expect(UCAT_SURFACE_MOTION).not.toMatch(/(?:^|\s|,)transform(?:\s|,|$)/);
  });
});
