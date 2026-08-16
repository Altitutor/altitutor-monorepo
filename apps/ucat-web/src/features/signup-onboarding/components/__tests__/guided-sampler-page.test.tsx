import React, { useEffect, useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type {
  QuestionEngineTutorialControl,
  QuestionEngineTutorialSnapshot,
} from "@/features/question-engine/components/question-engine-page";
import { GuidedSamplerPage } from "@/features/signup-onboarding/components/guided-sampler-page";

const replace = jest.fn();
let search = "familiarity=familiar";

class MockResizeObserver implements ResizeObserver {
  constructor(_callback: ResizeObserverCallback) {}
  disconnect() {}
  observe(_target: Element, _options?: ResizeObserverOptions) {}
  unobserve(_target: Element) {}
}

global.ResizeObserver = MockResizeObserver;

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(search),
}));

jest.mock("motion/react", () => {
  const MotionDiv = React.forwardRef<HTMLDivElement, React.PropsWithChildren>(
    ({ children }, ref) => <div ref={ref}>{children}</div>,
  );
  MotionDiv.displayName = "MotionDiv";

  return {
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
    useReducedMotion: () => false,
    motion: {
      div: MotionDiv,
      span: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
      p: ({ children }: React.PropsWithChildren) => <p>{children}</p>,
    },
  };
});

jest.mock("@/features/landing/components/marketing/noise-overlay", () => ({
  NoiseOverlay: () => null,
}));

jest.mock("@/features/onboarding/hooks/use-onboarding-progress", () => ({
  useCompleteOnboardingTour: () => ({ mutateAsync: jest.fn() }),
}));

const emptySnapshot: QuestionEngineTutorialSnapshot = {
  questionId: "sampler-vr-1",
  questionIndex: 0,
  selectedOptionId: null,
  placementSnapshot: {},
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
  onTutorialComplete?: () => void;
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
        <div data-tour="question-engine-stem">Question stem</div>
        {[
          ["sampler-dm-syllogism", "Open DM question"],
          ["sampler-qr-1", "Open QR question"],
          ["sampler-sjt-1", "Open SJ question"],
        ].map(([questionId, label]) => (
          <button
            key={questionId}
            type="button"
            onClick={() =>
              setSnapshot({ ...emptySnapshot, questionId, questionIndex: 0 })
            }
          >
            {label}
          </button>
        ))}
        <div data-tour="question-engine-question">
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
        </div>
        <button
          type="button"
          data-tour="question-engine-calculator"
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
        <button type="button" onClick={props.onTutorialComplete}>
          Complete section
        </button>
      </div>
    );
  },
}));

function renderStartedSampler() {
  render(<GuidedSamplerPage />);
  fireEvent.click(screen.getByRole("button", { name: "Start 2 VR questions" }));
}

describe("GuidedSamplerPage marking", () => {
  beforeEach(() => {
    search = "familiarity=familiar";
    replace.mockReset();
  });

  afterEach(() => jest.useRealTimers());

  it("briefs familiar students before starting the first section", () => {
    render(<GuidedSamplerPage />);

    expect(
      screen.getByRole("heading", { name: "Verbal Reasoning" }),
    ).toBeInTheDocument();
    expect(screen.getByText("What you’ll do")).toBeInTheDocument();
    expect(
      screen.getByText(/two questions from one passage/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Read the stem first/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Submit" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Start 2 VR questions" }),
    );
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
    expect(screen.getByText("Guided practice")).toBeInTheDocument();
    expect(
      screen.queryByText("Get familiar with Altitutor UCAT"),
    ).not.toBeInTheDocument();
  });

  it("shows completely new students the UCAT primer before the sampler", () => {
    search = "familiarity=new";
    render(<GuidedSamplerPage />);

    expect(
      screen.getByRole("heading", { name: "What is the UCAT?" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Back" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(
      screen.getByRole("heading", {
        name: "Each section tests a different skill",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Section 1: Verbal Reasoning.*tests your ability to read and comprehend/,
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(
      screen.getByRole("heading", { name: "What is the UCAT?" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(
      screen.getByRole("heading", { name: "Scoring" }),
    ).toBeInTheDocument();
    expect(screen.getByText("900–2700")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(
      screen.getByRole("heading", {
        name: "Fast, focused and fully on screen",
      }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Start sample questions" }),
    );

    expect(
      screen.getByRole("heading", { name: "Verbal Reasoning" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/coach you through the method/),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Start 2 VR questions" }),
    );
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
  });

  it("briefs experienced students with minimal-coaching expectations", () => {
    search = "familiarity=experienced";
    render(<GuidedSamplerPage />);

    expect(
      screen.getByText(/quick technique check.*Coaching stays minimal/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start 2 VR questions" }),
    ).toBeInTheDocument();
  });

  it("shows the next section briefing before mounting its questions", () => {
    renderStartedSampler();

    fireEvent.click(screen.getByRole("button", { name: "Complete section" }));

    expect(
      screen.getByRole("heading", { name: "Decision Making" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/five-part syllogism.*order of four talks/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start 2 DM questions" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Submit" }),
    ).not.toBeInTheDocument();
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

  it("starts inactivity nudges only when guided practice asks for an answer", () => {
    jest.useFakeTimers();
    renderStartedSampler();

    act(() => jest.advanceTimersByTime(31_000));
    expect(screen.queryByText("Need a nudge?")).not.toBeInTheDocument();
    expect(screen.getByText("1. Read the stem first")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    act(() => jest.advanceTimersByTime(31_000));
    expect(screen.queryByText("Need a nudge?")).not.toBeInTheDocument();
    expect(screen.getByText("2. Read the question")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Choose your answer")).toBeInTheDocument();

    act(() => jest.advanceTimersByTime(29_999));
    expect(screen.queryByText("Need a nudge?")).not.toBeInTheDocument();
    act(() => jest.advanceTimersByTime(1));
    expect(screen.getByText("Need a nudge?")).toBeInTheDocument();
  });

  it("starts each section walkthrough with the stem and names required controls", () => {
    renderStartedSampler();

    expect(screen.getByText("1. Read the stem first")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open DM question" }));
    expect(screen.getByText("1. Read the stem first")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(
      screen.getByText("2. Drag Yes or No to every conclusion"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Drag a Yes or No tile from the tray/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open QR question" }));
    expect(screen.getByText("1. Read the stem first")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("2. Open the UCAT calculator")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open SJ question" }));
    expect(screen.getByText("1. Read the stem first")).toBeInTheDocument();
  });

  it("starts inactivity timing immediately when coaching is minimal", () => {
    jest.useFakeTimers();
    search = "familiarity=experienced";
    renderStartedSampler();

    act(() => jest.advanceTimersByTime(30_000));

    expect(screen.getByText("Need a nudge?")).toBeInTheDocument();
  });

  it("shows the explanation after the correct answer", () => {
    renderStartedSampler();

    fireEvent.click(screen.getByRole("button", { name: "Choose correct" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(screen.getByText("That’s correct")).toBeInTheDocument();
    expect(screen.getByText(/create wildlife habitat/)).toBeInTheDocument();
    expect(screen.getByText(/Continue when/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Submit" }),
    ).not.toBeInTheDocument();
    // Engine navigator + feedback card both offer Next
    expect(screen.getAllByRole("button", { name: "Next" })).toHaveLength(2);
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
    expect(
      screen.queryByRole("button", { name: "Submit" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to question" }));

    expect(screen.getByText("That’s correct")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Submit" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Next" })).toHaveLength(2);
  });
});
