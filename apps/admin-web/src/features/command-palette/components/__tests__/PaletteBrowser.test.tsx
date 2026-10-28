import { render, screen, waitFor, within } from "@testing-library/react";
import { Copy } from "lucide-react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PaletteBrowser } from "../PaletteBrowser";

it("loads the next scoped page and removes Show more at the end", async () => {
  const students = Array.from({ length: 31 }, (_, index) => ({
    type: "student" as const,
    id: String(index + 1),
    title: `Student ${index + 1}`,
  }));
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PaletteBrowser
        isOpen
        onClose={() => {}}
        onEntitySelected={() => {}}
        commands={[]}
        pages={[]}
        searchEntities={async ({ offset = 0, limit }) => ({
          results: students.slice(offset, offset + limit),
          hasMore: offset + limit < students.length,
        })}
      />
    </QueryClientProvider>,
  );
  await user.click(screen.getByRole("option", { name: "Students" }));
  await user.click(
    await screen.findByRole("button", { name: "Show more results" }),
  );
  expect(
    await screen.findByRole("option", { name: "Student 31" }),
  ).toBeVisible();
  expect(screen.getAllByRole("option")).toHaveLength(31);
  expect(
    screen.queryByRole("button", { name: "Show more results" }),
  ).not.toBeInTheDocument();
});

it("enters Students with Enter, searches only that submenu, and returns with Backspace", async () => {
  const user = userEvent.setup();
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <PaletteBrowser
        isOpen
        onClose={() => {}}
        onEntitySelected={() => {}}
        commands={[]}
        pages={[]}
        searchEntities={async ({ type, search }) => ({
          results:
            type === "student" &&
            (!search || "alice williams".includes(search.toLowerCase()))
              ? [{ id: "alice", type: "student", title: "Alice Williams" }]
              : [],
          hasMore: false,
        })}
      />
    </QueryClientProvider>,
  );
  const input = screen.getByRole("searchbox", {
    name: "Search commands and entities",
  });
  await user.type(input, "stud{Enter}");
  expect(input).toHaveAttribute("placeholder", "Search Students…");
  expect(input).toHaveValue("");
  await user.type(input, "Ali");
  expect(
    await screen.findByRole("option", { name: "Alice Williams" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("option", { name: "Staff" }),
  ).not.toBeInTheDocument();
  await user.clear(input);
  await user.keyboard("{Backspace}");
  await waitFor(() =>
    expect(input).toHaveAttribute(
      "placeholder",
      "Search commands and entities…",
    ),
  );
  expect(screen.getByRole("option", { name: "Students" })).toBeVisible();
});

it("distinguishes action targets with an entity pill and mutes only ancestor labels", async () => {
  const action = jest.fn();
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PaletteBrowser
        isOpen
        onClose={() => {}}
        onEntitySelected={() => {}}
        pages={[]}
        commands={[
          {
            id: "copy",
            title: "Copy ID",
            icon: Copy,
            action,
            target: { type: "student", id: "alice", title: "Alice Williams" },
          },
        ]}
        searchEntities={async () => ({ results: [], hasMore: false })}
      />
    </QueryClientProvider>,
  );
  await user.type(screen.getByRole("searchbox"), "Copy ID");
  const option = await screen.findByRole("option", {
    name: "Commands Copy ID Alice Williams",
  });
  const pill = within(option)
    .getByText("Alice Williams")
    .closest("[data-entity-type]");
  expect(pill).toHaveAttribute("data-entity-type", "student");
  expect(pill?.querySelector("svg")).not.toBeNull();
  expect(within(option).getByText("Commands")).toHaveClass(
    "text-muted-foreground",
  );
  expect(within(option).getByText("Copy ID")).toHaveClass("text-foreground");
  await user.click(option);
  expect(action).toHaveBeenCalledTimes(1);
});

it("keeps a topic subtree scoped, offers an explicit Open action, and uses Escape to return", async () => {
  const user = userEvent.setup();
  const opened = jest.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PaletteBrowser
        isOpen
        onClose={() => {}}
        onEntitySelected={opened}
        commands={[]}
        pages={[]}
        searchEntities={async ({ type, subjectId, topicId }) => ({
          results:
            type === "subject"
              ? [{ type: "subject", id: "math", title: "12MATH" }]
              : type === "topic" && subjectId === "math" && !topicId
                ? [
                    {
                      type: "topic",
                      id: "functions",
                      title: "Functions",
                      parents: [
                        { type: "subject", id: "math", title: "12MATH" },
                      ],
                    },
                  ]
                : type === "topic" && topicId === "functions"
                  ? [
                      {
                        type: "topic",
                        id: "linear",
                        title: "Linear Functions",
                        parents: [
                          { type: "subject", id: "math", title: "12MATH" },
                          {
                            type: "topic",
                            id: "functions",
                            title: "Functions",
                          },
                        ],
                      },
                    ]
                  : [],
          hasMore: false,
        })}
      />
    </QueryClientProvider>,
  );
  await user.click(screen.getByRole("option", { name: "Subjects" }));
  await user.click(await screen.findByRole("option", { name: "12MATH" }));
  await user.click(await screen.findByRole("option", { name: "Functions" }));
  expect(
    await screen.findByRole("option", { name: "Linear Functions" }),
  ).toBeVisible();
  await user.type(screen.getByRole("searchbox"), "Linear");
  expect(
    screen.queryByRole("option", { name: "Open topic Functions" }),
  ).not.toBeInTheDocument();
  await user.clear(screen.getByRole("searchbox"));
  await user.click(
    screen.getByRole("option", { name: "Open topic Functions" }),
  );
  expect(opened).toHaveBeenCalledWith("topic", "functions");
  await user.click(screen.getByRole("searchbox"));
  await user.keyboard("{Escape}");
  expect(screen.getByRole("searchbox")).toHaveAttribute(
    "placeholder",
    "Search 12MATH…",
  );
});
