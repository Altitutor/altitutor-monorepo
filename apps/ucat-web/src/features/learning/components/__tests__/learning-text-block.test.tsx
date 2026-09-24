import React from "react";
import { act, render } from "@testing-library/react";
import type { LearningModuleBlockRow } from "@/features/learning/types";
import { LearningTextBlock } from "../learning-text-block";

jest.mock("@/features/question-engine/components/rich-content-block", () => ({
  RichContentBlock: () => <div>Lesson text</div>,
}));

class IntersectionObserverMock implements IntersectionObserver {
  static instances: IntersectionObserverMock[] = [];

  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0];
  private readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    IntersectionObserverMock.instances.push(this);
  }

  disconnect = jest.fn();
  observe = jest.fn();
  takeRecords = jest.fn(() => []);
  unobserve = jest.fn();

  emit(isIntersecting: boolean) {
    this.callback(
      [
        {
          boundingClientRect: {} as DOMRectReadOnly,
          intersectionRatio: isIntersecting ? 1 : 0,
          intersectionRect: {} as DOMRectReadOnly,
          isIntersecting,
          rootBounds: null,
          target: document.createElement("div"),
          time: 0,
        },
      ],
      this,
    );
  }
}

const block: LearningModuleBlockRow = {
  block_completed_at: null,
  block_type: "text",
  content: { body: { type: "doc", content: [] } },
  file_id: null,
  id: "text-block-1",
  index: 0,
  interaction_state: null,
  learning_module_id: "lesson-1",
  manually_completed: false,
  question_id: null,
  question_stem_id: null,
  require_completion_before_next: false,
  skill_trainer_id: null,
};

describe("TextBlock", () => {
  beforeEach(() => {
    IntersectionObserverMock.instances = [];
    window.IntersectionObserver = IntersectionObserverMock;
  });

  it("completes when the end of the text is visible on initial load", () => {
    const onViewed = jest.fn();

    render(<LearningTextBlock block={block} onViewed={onViewed} />);

    expect(IntersectionObserverMock.instances).toHaveLength(1);

    act(() => {
      IntersectionObserverMock.instances[0]?.emit(true);
    });

    expect(onViewed).toHaveBeenCalledTimes(1);

    act(() => {
      IntersectionObserverMock.instances[0]?.emit(true);
    });

    expect(onViewed).toHaveBeenCalledTimes(1);
  });

  it("completes after scrolling the end of the text into view", () => {
    const onViewed = jest.fn();

    render(<LearningTextBlock block={block} onViewed={onViewed} />);

    act(() => {
      IntersectionObserverMock.instances[0]?.emit(false);
    });
    expect(onViewed).not.toHaveBeenCalled();

    act(() => {
      IntersectionObserverMock.instances[0]?.emit(true);
    });
    expect(onViewed).toHaveBeenCalledTimes(1);
  });
});
