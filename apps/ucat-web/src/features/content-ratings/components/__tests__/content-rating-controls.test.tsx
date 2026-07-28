import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ContentRatingControls } from "../content-rating-controls";
import type { UcatContentRatingDescriptor } from "../../types";

jest.mock("@altitutor/ui", () => {
  const ReactModule = jest.requireActual<typeof import("react")>("react");
  const actual =
    jest.requireActual<typeof import("@altitutor/ui")>("@altitutor/ui");
  type PopoverState = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  };
  const PopoverContext = ReactModule.createContext<PopoverState>({
    open: false,
    onOpenChange: () => {},
  });
  return {
    ...actual,
    Popover: ({
      open = false,
      onOpenChange,
      children,
    }: {
      open?: boolean;
      onOpenChange: (open: boolean) => void;
      children: React.ReactNode;
    }) =>
      ReactModule.createElement(
        PopoverContext.Provider,
        { value: { open, onOpenChange } },
        children,
      ),
    PopoverTrigger: ({
      children,
    }: {
      children: React.ReactElement<{
        onClick?: (event: React.MouseEvent) => void;
      }>;
    }) => {
      const { open, onOpenChange } = ReactModule.useContext(PopoverContext);
      return ReactModule.cloneElement(children, {
        onClick: (event: React.MouseEvent) => {
          children.props.onClick?.(event);
          onOpenChange(!open);
        },
      });
    },
    PopoverContent: ({ children }: { children: React.ReactNode }) => {
      const { open } = ReactModule.useContext(PopoverContext);
      return open ? ReactModule.createElement("div", null, children) : null;
    },
  };
});

const descriptor: UcatContentRatingDescriptor = {
  targetType: "question_insight",
  targetKey: "question:rushed",
  targetVersion: "v1-test",
  contextKey: "set-attempt:test:question:test",
  surface: "attempt",
  displayedContent: {
    title: "This one looks rushed",
    body: "Review the reasoning step you skipped.",
  },
};

const questionDescriptor: UcatContentRatingDescriptor = {
  targetType: "question",
  targetKey: "question:4a2c0e82-0d99-4933-a3e1-4652ea3cc4ff",
  targetVersion: "v1-question",
  contextKey: "set-attempt:test:question:test",
  surface: "attempt",
  displayedContent: {
    question: '{"questionText":"Which answer is correct?"}',
  },
};

function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    json: async () => payload,
  } as Response;
}

function renderControls(
  ratingDescriptor: UcatContentRatingDescriptor = descriptor,
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  queryClient.setQueryData(
    [
      "ucat-content-rating",
      `${ratingDescriptor.targetType}:${ratingDescriptor.targetKey}:${ratingDescriptor.targetVersion}:${ratingDescriptor.contextKey}`,
    ],
    null,
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <ContentRatingControls descriptor={ratingDescriptor} />
    </QueryClientProvider>,
  );
}

describe("ContentRatingControls", () => {
  beforeEach(() => {
    global.fetch = jest.fn(async (_input, init) => {
      if (!init?.method) return jsonResponse({ rating: null });
      const body = JSON.parse(String(init.body)) as {
        rating: {
          vote: -1 | 1;
          reasonCode: string | null;
          reasonText: string | null;
        };
      };
      return jsonResponse({ rating: body.rating });
    }) as jest.MockedFunction<typeof fetch>;
  });

  afterEach(() => {
    delete (global as { fetch?: typeof fetch }).fetch;
  });

  it("keeps reasons as drafts until Submit and dismisses after saving", async () => {
    renderControls();

    fireEvent.click(
      screen.getByRole("button", { name: "This was not helpful" }),
    );
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    fireEvent.click(
      screen.getByRole("button", { name: "It seems inaccurate" }),
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        screen.queryByText("What could be better?"),
      ).not.toBeInTheDocument(),
    );

    const request = jest.mocked(global.fetch).mock.calls[1];
    const body = JSON.parse(String(request?.[1]?.body)) as {
      rating: { reasonCode: string | null; reasonText: string | null };
    };
    expect(body.rating).toMatchObject({
      reasonCode: "inaccurate",
      reasonText: null,
    });
  });

  it("submits a note without requiring a preset reason", async () => {
    renderControls();

    fireEvent.click(
      screen.getByRole("button", { name: "This was not helpful" }),
    );
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    fireEvent.change(
      screen.getByPlaceholderText("Tell us what would make this more useful"),
      { target: { value: "The comparison needs more context." } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));

    const request = jest.mocked(global.fetch).mock.calls[1];
    const body = JSON.parse(String(request?.[1]?.body)) as {
      rating: { reasonCode: string | null; reasonText: string | null };
    };
    expect(body.rating).toEqual({
      vote: -1,
      reasonCode: null,
      reasonText: "The comparison needs more context.",
    });
  });

  it("uses question-specific copy and issue reasons", async () => {
    renderControls(questionDescriptor);

    expect(screen.getByText("Rate this question")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "This question needs attention" }),
    );
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    expect(screen.getByText("What should we review?")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "The answer seems incorrect" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));

    const request = jest.mocked(global.fetch).mock.calls[1];
    const body = JSON.parse(String(request?.[1]?.body)) as {
      descriptor: { targetType: string };
      rating: { reasonCode: string | null };
    };
    expect(body).toMatchObject({
      descriptor: { targetType: "question" },
      rating: { reasonCode: "answer_incorrect" },
    });
  });
});
