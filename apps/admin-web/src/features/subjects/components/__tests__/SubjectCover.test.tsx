import { createElement } from "react";
import { render, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SubjectCover } from "../SubjectCover";
import { subjectsKeys } from "../../hooks/useSubjectsQuery";

let mockCoverPath: string | null = null;
jest.mock("next/image", () => ({
  __esModule: true,
  default: ({
    unoptimized: _unoptimized,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) =>
    createElement("img", props),
}));
jest.mock("@/shared/lib/supabase/client", () => ({
  getSupabaseClient: () => ({
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        is: () => query,
        maybeSingle: async () => ({
          data:
            table === "subjects_files"
              ? mockCoverPath
                ? { file_id: "cover" }
                : null
              : { storage_path: mockCoverPath, bucket: "resources" },
          error: null,
        }),
      };
      return query;
    },
    storage: {
      from: () => ({
        createSignedUrl: async (path: string) => ({
          data: { signedUrl: `https://storage.example.test/${path}` },
          error: null,
        }),
      }),
    },
  }),
}));

it("refreshes cached absent, changed, and removed covers after subject invalidation", async () => {
  mockCoverPath = null;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SubjectCover subjectId="subject" />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(client.isFetching()).toBe(0));
  expect(document.querySelector("img")).toBeNull();
  mockCoverPath = "first.jpg";
  await act(() => client.invalidateQueries({ queryKey: subjectsKeys.all }));
  await waitFor(() =>
    expect(document.querySelector("img")).toHaveAttribute(
      "src",
      "https://storage.example.test/first.jpg",
    ),
  );
  mockCoverPath = "replacement.jpg";
  await act(() => client.invalidateQueries({ queryKey: subjectsKeys.all }));
  await waitFor(() =>
    expect(document.querySelector("img")).toHaveAttribute(
      "src",
      "https://storage.example.test/replacement.jpg",
    ),
  );
  mockCoverPath = null;
  await act(() => client.invalidateQueries({ queryKey: subjectsKeys.all }));
  await waitFor(() => expect(document.querySelector("img")).toBeNull());
});
