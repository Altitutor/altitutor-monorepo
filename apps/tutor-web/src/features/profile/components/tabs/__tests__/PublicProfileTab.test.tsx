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
      Slider: ({
        value,
        onValueChange,
        ...props
      }: React.InputHTMLAttributes<HTMLInputElement> & {
        value?: number[];
        onValueChange?: (value: number[]) => void;
      }) =>
        element("input", {
          ...props,
          type: "range",
          value: value?.[0],
          onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
            onValueChange?.([Number(event.target.value)]),
        }),
      useToast: () => ({ toast }),
    };
  },
  { virtual: true },
);

jest.mock("next/image", () => ({
  __esModule: true,
  default: (
    props: React.ImgHTMLAttributes<HTMLImageElement> & {
      fill?: boolean;
      unoptimized?: boolean;
    },
  ) => {
    const imageProps = { ...props };
    delete imageProps.fill;
    delete imageProps.unoptimized;
    return React.createElement("img", imageProps);
  },
}));

jest.mock("../../../api", () => ({
  profileApi: {
    getProfileImage: jest.fn(),
    uploadProfileImage: jest.fn(),
    updateProfileImageCrop: jest.fn(),
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
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: jest.fn(() => "blob:profile-image"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: jest.fn(),
    });
    jest.mocked(profileApi.getProfileImage).mockResolvedValue({
      url: null,
      crop: { x: 50, y: 50, zoom: 1 },
    });
    jest
      .mocked(profileApi.uploadProfileImage)
      .mockResolvedValue("90000000-0000-0000-0000-000000000002");
    jest.mocked(profileApi.updateProfileImageCrop).mockResolvedValue();
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
    fireEvent.change(await screen.findByLabelText("Profile picture zoom"), {
      target: { value: "1.5" },
    });
    fireEvent.change(screen.getByLabelText("Horizontal position"), {
      target: { value: "35" },
    });
    fireEvent.change(screen.getByLabelText("Vertical position"), {
      target: { value: "65" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(profileApi.uploadProfileImage).toHaveBeenCalledWith(
        profile.id,
        image,
        { x: 35, y: 65, zoom: 1.5 },
      );
      expect(mutateAsync).toHaveBeenCalledWith({
        profile_bio: "A new public introduction.",
        profile_image_file_id: "90000000-0000-0000-0000-000000000002",
      });
    });
  });

  it("updates the crop metadata without replacing an existing original image", async () => {
    jest.mocked(profileApi.getProfileImage).mockResolvedValue({
      url: "https://example.com/profile.jpg",
      crop: { x: 40, y: 60, zoom: 1.2 },
    });
    const profileWithImage = {
      ...profile,
      profile_image_file_id: "90000000-0000-0000-0000-000000000003",
    };

    render(<PublicProfileTab profile={profileWithImage} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(await screen.findByLabelText("Profile picture zoom"), {
      target: { value: "1.8" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(profileApi.updateProfileImageCrop).toHaveBeenCalledWith(
        profileWithImage.profile_image_file_id,
        { x: 40, y: 60, zoom: 1.8 },
      );
      expect(profileApi.uploadProfileImage).not.toHaveBeenCalled();
    });
  });
});
