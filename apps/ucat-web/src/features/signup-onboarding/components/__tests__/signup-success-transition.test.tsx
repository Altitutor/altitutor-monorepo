import React from "react";
import { render, screen } from "@testing-library/react";
import { SignupSuccessTransition } from "@/features/signup-onboarding/components/signup-success-transition";

jest.mock("motion/react", () => {
  const React = jest.requireActual("react") as typeof import("react");
  type MotionProps = React.PropsWithChildren<
    React.HTMLAttributes<HTMLElement> & {
      initial?: unknown;
      animate?: unknown;
      exit?: unknown;
      transition?: unknown;
      layout?: unknown;
    }
  >;
  const motionComponent = (tag: string) =>
    React.forwardRef<HTMLElement, MotionProps>(function MotionComponent(
      {
        children,
        initial: _initial,
        animate: _animate,
        exit: _exit,
        transition: _transition,
        layout: _layout,
        ...props
      },
      ref,
    ) {
      return React.createElement(tag, { ...props, ref }, children);
    });

  return {
    AnimatePresence: ({ children }: React.PropsWithChildren) => children,
    motion: new Proxy(
      {},
      {
        get: (_target, tag: string) => motionComponent(tag),
      },
    ),
    useReducedMotion: () => true,
  };
});

jest.mock("@/features/landing/components/marketing/noise-overlay", () => ({
  NoiseOverlay: () => null,
}));

const defaultProps = {
  occasion: "signup" as const,
  phase: "confirming" as const,
  isTakingLonger: false,
  error: null,
  onRetry: jest.fn(),
  onComplete: jest.fn(),
};

describe("SignupSuccessTransition", () => {
  it("uses Free-appropriate copy for a Free signup", () => {
    render(<SignupSuccessTransition {...defaultProps} journey="free" />);

    expect(
      screen.getByRole("heading", {
        name: "Personalising your UCAT workspace",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Your Free plan is ready/)).toBeInTheDocument();
    expect(screen.queryByText(/payment is complete/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText("Practise without limits"),
    ).not.toBeInTheDocument();
  });

  it("keeps paid-plan confirmation copy for a paid signup", () => {
    render(<SignupSuccessTransition {...defaultProps} journey="paid" />);

    expect(
      screen.getByRole("heading", { name: "Building your UCAT workspace" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Your payment is complete/)).toBeInTheDocument();
    expect(screen.getByText("Practise without limits")).toBeInTheDocument();
  });

  it("uses upgrade-specific welcome copy for an existing student", () => {
    render(
      <SignupSuccessTransition
        {...defaultProps}
        journey="paid"
        occasion="upgrade"
        phase="welcome"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Your new plan is ready" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Upgrade complete")).toBeInTheDocument();
    expect(
      screen.queryByText("Thank you for joining us"),
    ).not.toBeInTheDocument();
  });
});
