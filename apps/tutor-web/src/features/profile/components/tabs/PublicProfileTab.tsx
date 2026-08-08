"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import type { Database } from "@altitutor/shared";
import { Button, Label, Textarea, useToast } from "@altitutor/ui";
import { Loader2, Pencil } from "lucide-react";
import { z } from "zod";
import { profileApi } from "../../api";
import { useUpdateProfile } from "../../hooks";

type TutorProfile = Database["public"]["Views"]["vtutor_profile"]["Row"];

interface PublicProfileTabProps {
  profile: TutorProfile;
}

const publicProfileFormSchema = z.object({
  profile_bio: z.string().max(1200, "Bio must be 1200 characters or fewer"),
});

const acceptedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageSizeBytes = 5 * 1024 * 1024;

export function PublicProfileTab({ profile }: PublicProfileTabProps) {
  const { toast } = useToast();
  const updateProfile = useUpdateProfile();
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profileBio, setProfileBio] = useState(profile.profile_bio ?? "");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    profileApi
      .getProfileImageUrl(profile.profile_image_file_id)
      .then((url) => {
        if (!cancelled) setProfileImageUrl(url);
      })
      .catch(() => {
        if (!cancelled) setProfileImageUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [profile.profile_image_file_id]);

  const handleCancel = () => {
    setProfileBio(profile.profile_bio ?? "");
    setSelectedImage(null);
    setIsEditing(false);
  };

  const handleImageChange = (file: File | null) => {
    if (
      file &&
      (!acceptedImageTypes.has(file.type) || file.size > maxImageSizeBytes)
    ) {
      toast({
        title: "Validation Error",
        description: "Choose a JPEG, PNG, or WebP image up to 5 MB",
        variant: "destructive",
      });
      setSelectedImage(null);
      return;
    }

    setSelectedImage(file);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validation = publicProfileFormSchema.safeParse({
      profile_bio: profileBio,
    });
    if (!validation.success) {
      toast({
        title: "Validation Error",
        description:
          validation.error.errors[0]?.message ??
          "Check your public profile details",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    let profileImageFileId = profile.profile_image_file_id;

    try {
      if (selectedImage) {
        if (!profile.id) throw new Error("Profile ID is missing");
        profileImageFileId = await profileApi.uploadProfileImage(
          profile.id,
          selectedImage,
        );
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to upload profile picture",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    try {
      await updateProfile.mutateAsync({
        profile_bio: validation.data.profile_bio.trim() || null,
        profile_image_file_id: profileImageFileId,
      });

      setSelectedImage(null);
      setIsEditing(false);
    } catch {
      // useUpdateProfile surfaces mutation errors consistently across profile tabs.
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayName =
    `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();

  if (isEditing) {
    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Public profile</h2>
            <p className="text-sm text-muted-foreground">
              This information will be shown on Altitutor&apos;s public website
              in the future.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save changes
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="public-profile-image">Profile picture</Label>
          <input
            id="public-profile-image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) =>
              handleImageChange(event.target.files?.[0] ?? null)
            }
            className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
          />
          <p className="text-xs text-muted-foreground">
            JPEG, PNG, or WebP up to 5 MB.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="public-profile-bio">Bio</Label>
            <span className="text-xs text-muted-foreground">
              {profileBio.length}/1200
            </span>
          </div>
          <Textarea
            id="public-profile-bio"
            value={profileBio}
            onChange={(event) => setProfileBio(event.target.value)}
            rows={8}
            maxLength={1200}
            placeholder="Introduce yourself to prospective students and families"
          />
          <p className="text-xs text-muted-foreground">
            Plain text. Use blank lines for paragraph breaks.
          </p>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Public profile</h2>
          <p className="text-sm text-muted-foreground">
            This information will be shown on Altitutor&apos;s public website in
            the future.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
      </div>

      <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
        <div>
          {profileImageUrl ? (
            <Image
              src={profileImageUrl}
              alt={displayName || "Tutor profile picture"}
              width={112}
              height={112}
              className="h-28 w-28 rounded-full object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-muted text-3xl font-semibold text-muted-foreground">
              {displayName.charAt(0).toUpperCase() || "?"}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <h3 className="font-medium">Bio</h3>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {profile.profile_bio || "No public bio added yet."}
          </p>
        </div>
      </div>
    </div>
  );
}
