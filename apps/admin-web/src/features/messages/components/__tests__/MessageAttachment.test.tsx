import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";

import { getSupabaseClient } from "@/shared/lib/supabase/client";

import { MessageAttachment } from "../MessageThread";

jest.mock("@/shared/lib/supabase/client", () => ({
  getSupabaseClient: jest.fn(),
}));

const mockGetSupabaseClient = getSupabaseClient as jest.MockedFunction<
  typeof getSupabaseClient
>;

describe("MessageAttachment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not send a BlueBubbles attachment locator to Supabase Storage", async () => {
    const createSignedUrl = jest.fn().mockResolvedValue({
      data: { signedUrl: "https://example.test/signed" },
      error: null,
    });
    const from = jest.fn(() => ({ createSignedUrl }));
    mockGetSupabaseClient.mockReturnValue({
      storage: { from },
    } as unknown as ReturnType<typeof getSupabaseClient>);

    const attachment = {
      storage_url: "bluebubbles:/attachment-guid",
      filename: "photo.jpg",
      mime_type: "image/jpeg",
    } as ComponentProps<typeof MessageAttachment>["attachment"];

    render(<MessageAttachment attachment={attachment} direction="INBOUND" />);

    expect(
      await screen.findByText("photo.jpg (not available)"),
    ).toBeInTheDocument();
    expect(from).not.toHaveBeenCalled();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("continues to sign a messages-media Storage object path", async () => {
    const createSignedUrl = jest.fn().mockResolvedValue({
      data: { signedUrl: "https://example.test/signed" },
      error: null,
    });
    const from = jest.fn(() => ({ createSignedUrl }));
    mockGetSupabaseClient.mockReturnValue({
      storage: { from },
    } as unknown as ReturnType<typeof getSupabaseClient>);

    const attachment = {
      storage_url: "inbound/attachment-guid/photo.jpg",
      filename: "photo.jpg",
      mime_type: "image/jpeg",
    } as ComponentProps<typeof MessageAttachment>["attachment"];

    render(<MessageAttachment attachment={attachment} direction="INBOUND" />);

    expect(
      await screen.findByRole("link", { name: "photo.jpg" }),
    ).toHaveAttribute("href", "https://example.test/signed");
    expect(from).toHaveBeenCalledWith("messages-media");
    expect(createSignedUrl).toHaveBeenCalledWith(
      "inbound/attachment-guid/photo.jpg",
      3600,
    );
  });
});
