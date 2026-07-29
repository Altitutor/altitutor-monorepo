import { act, renderHook } from "@testing-library/react";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";

let mockReduceMotion: boolean | null = null;

jest.mock("motion/react", () => ({
  useReducedMotion: () => mockReduceMotion,
}));

describe("useUcatStaggerMotion", () => {
  beforeEach(() => {
    mockReduceMotion = null;
  });

  it("keeps variant object identity when reduceMotion resolves null → false", () => {
    const { result, rerender } = renderHook(() => useUcatStaggerMotion());

    const firstContainer = result.current.containerVariants;
    const firstItem = result.current.itemVariants;

    act(() => {
      mockReduceMotion = false;
      rerender();
    });

    // Motion restarts stagger when `variants` identity changes. null and false
    // both mean "allow motion", so objects must stay referentially stable.
    expect(result.current.containerVariants).toBe(firstContainer);
    expect(result.current.itemVariants).toBe(firstItem);
  });

  it("rebuilds variants when reduceMotion becomes true", () => {
    mockReduceMotion = false;
    const { result, rerender } = renderHook(() => useUcatStaggerMotion());

    const firstItem = result.current.itemVariants;

    act(() => {
      mockReduceMotion = true;
      rerender();
    });

    expect(result.current.itemVariants).not.toBe(firstItem);
    expect(result.current.itemVariants.hidden).toEqual({ opacity: 1, y: 0 });
  });
});
