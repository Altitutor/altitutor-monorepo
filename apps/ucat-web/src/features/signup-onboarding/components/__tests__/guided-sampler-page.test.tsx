import React, { useEffect, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type {
  QuestionEngineTutorialControl,
  QuestionEngineTutorialSnapshot,
} from "@/features/question-engine/components/question-engine-page";
import { GuidedSamplerPage } from "@/features/signup-onboarding/components/guided-sampler-page";

const replace = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams("familiarity=familiar"),
}));

jest.mock("motion/react", () => ({
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
  motion: {
    div: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    span: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
    p: ({ children }: React.PropsWithChildren) => <p>{children}</p>,
  },
}));

jest.mock("@/features/landing/components/marketing/noise-overlay", () => ({
  NoiseOverlay: () => null,
}));

jest.mock("@/features/onboarding/hooks/use-onboarding-progress", () => ({
  useCompleteOnboardingTour: () => ({ mutateAsync: jest.fn() }),
}));

jest.mock("@/features/onboarding/config/tour-steps", () => ({
  UCAT_QUESTION_ENGINE_TOUR: "ucat-question-engine",
}));

const emptySnapshot: QuestionEngineTutorialSnapshot = {
  questionId: "sampler-vr-1",
  questionIndex: 0,
  selectedOptionId: null,
  syllogismSnapshot: {},
  flagged: false,
  showCalculator: false,
  showNavigator: false,
  calculatorDisplay: "0",
};

type MockEngineProps = {
  onTutorialStateChange?: (snapshot: QuestionEngineTutorialSnapshot) => void;
  onTutorialRequestNext?: (snapshot: QuestionEngineTutorialSnapshot) => boolean;
  onTutorialControl?: (
    control: QuestionEngineTutorialControl,
    snapshot: QuestionEngineTutorialSnapshot,
  ) => boolean | void;
  tutorialHidePrimaryAction?: boolean;
  tutorialPrimaryActionLabel?: string;
};

jest.mock("@/features/question-engine/components/question-engine-page", () => ({
  QuestionEnginePage: (props: MockEngineProps) => {
    const [snapshot, setSnapshot] = useState(emptySnapshot);
    const { onTutorialStateChange } = props;
    useEffect(
      () => onTutorialStateChange?.(snapshot),
      [onTutorialStateChange, snapshot],
    );

    const select = (optionId: string) => {
      const next = { ...snapshot, selectedOptionId: optionId };
      setSnapshot(next);
      props.onTutorialStateChange?.(next);
    };

    return (
      <div>
        <button type="button" onClick={() => select("sampler-vr-1-b")}>
          Choose wrong
        </button>
        <button type="button" onClick={() => select("sampler-vr-1-c")}>
          Choose another wrong
        </button>
        <button type="button" onClick={() => select("sampler-vr-1-a")}>
          Choose correct
        </button>
        {!props.tutorialHidePrimaryAction ? (
          <button
            type="button"
            onClick={() => props.onTutorialRequestNext?.(snapshot)}
          >
            {props.tutorialPrimaryActionLabel ?? "Next"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => props.onTutorialControl?.("calculator", snapshot)}
        >
          Calculator
        </button>
        <button
          type="button"
          onClick={() => props.onTutorialControl?.("navigator", snapshot)}
        >
          Navigator
        </button>
      </div>
    );
  },
}));

function renderStartedSampler() {
  render(<GuidedSamplerPage />);
  fireEvent.click(screen.getByRole("button", { name: "Start sampler" }));
}

describe("GuidedSamplerPage marking", () => {
  it("explains the Alti UCAT sampler before familiar students enter the engine", () => {
    render(<GuidedSamplerPage />);

    expect(
      screen.getByRole("heading", {
        name: "Get familiar with the Alti UCAT system",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/quick orientation to Alti UCAT/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Skip for now" }),
    ).toBeInTheDocument();
  });

  it("keeps the student on the question and reveals a hint after a wrong answer", () => {
    renderStartedSampler();

    fireEvent.click(screen.getByRole("button", { name: "Choose wrong" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(screen.getByText("Not quite—try again")).toBeInTheDocument();
    expect(screen.getByText(/wildlife habitat/)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Choose another wrong" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(screen.getByText(/reintroducing wetlands/)).toBeInTheDocument();
  });

  it("shows the explanation after the correct answer", () => {
    renderStartedSampler();

    fireEvent.click(screen.getByRole("button", { name: "Choose correct" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(screen.getByText("That’s correct")).toBeInTheDocument();
    expect(screen.getByText(/create wildlife habitat/)).toBeInTheDocument();
    expect(screen.getByText(/Continue when/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  it("redirects calculator use during Verbal Reasoning", () => {
    renderStartedSampler();

    fireEvent.click(screen.getByRole("button", { name: "Calculator" }));

    expect(screen.getByText("Stay with the passage")).toBeInTheDocument();
    expect(screen.getByText(/Quantitative Reasoning/)).toBeInTheDocument();
  });

  it("restores correct-answer feedback after finding the Navigator", () => {
    renderStartedSampler();

    fireEvent.click(screen.getByRole("button", { name: "Choose correct" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    fireEvent.click(screen.getByRole("button", { name: "Navigator" }));

    expect(screen.getByText("You found the Navigator")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to question" }));

    expect(screen.getByText("That’s correct")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });
});
