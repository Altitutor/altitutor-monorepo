import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PublicProfileTab } from "../PublicProfileTab";
import { profileApi } from "../../../api";
import { useUpdateProfile } from "../../../hooks";

const toast = jest.fn();

jest.mock(
  "@altitutor/ui",
  () => {
    const React = jest.requireActual<typeof import("react")>("react");
    const element = React.createElement;

    return {
      Button: ({
        children,
        ...props
      }: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
        element("button", props, children),
      Label: ({
        children,
        ...props
      }: React.LabelHTMLAttributes<HTMLLabelElement>) =>
        element("label", props, children),
      Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) =>
        element("textarea", props),
      useToast: () => ({ toast }),
    };
  },
  { virtual: true },
);

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
    const { alt, ...imageProps } = props;
    return React.createElement("img", { ...imageProps, alt });
  },
}));

jest.mock("../../../api", () => ({
  profileApi: {
    getProfileImageUrl: jest.fn(),
    uploadProfileImage: jest.fn(),
  },
}));

jest.mock("../../../hooks", () => ({
  useUpdateProfile: jest.fn(),
}));

const profile = {
  id: "90000000-0000-0000-0000-000000000001",
  first_name: "Test",
  last_name: "Tutor",
  profile_bio: "An experienced tutor.",
  profile_image_file_id: null,
} as React.ComponentProps<typeof PublicProfileTab>["profile"];

const mutateAsync = jest.fn();

describe("PublicProfileTab", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(profileApi.getProfileImageUrl).mockResolvedValue(null);
    jest
      .mocked(profileApi.uploadProfileImage)
      .mockResolvedValue("90000000-0000-0000-0000-000000000002");
    jest
      .mocked(useUpdateProfile)
      .mockReturnValue({ mutateAsync } as unknown as ReturnType<
        typeof useUpdateProfile
      >);
    mutateAsync.mockResolvedValue({});
  });

  it("lets a tutor edit their public bio and profile picture", async () => {
    render(<PublicProfileTab profile={profile} />);

    expect(screen.getByText("An experienced tutor.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    fireEvent.change(screen.getByLabelText("Bio"), {
      target: { value: "A new public introduction." },
    });
    const image = new File(["image"], "profile.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Profile picture"), {
      target: { files: [image] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(profileApi.uploadProfileImage).toHaveBeenCalledWith(
        profile.id,
        image,
      );
      expect(mutateAsync).toHaveBeenCalledWith({
        profile_bio: "A new public introduction.",
        profile_image_file_id: "90000000-0000-0000-0000-000000000002",
      });
    });
  });
});
