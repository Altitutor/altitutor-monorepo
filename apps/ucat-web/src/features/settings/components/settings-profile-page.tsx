"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, useToast } from "@altitutor/ui";
import { AppShellBottomFloatingDock, UcatPageHeader } from "@/features/layout";
import { AppPageSkeleton } from "@/features/layout/components/app-page-skeleton";
import { useAuth } from "@/features/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  UCAT_SURFACE_CARD,
  UCAT_SURFACE_MOTION,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { SettingsRow } from "@/features/settings/components/settings-row";
import { UCAT_PROFILE_QUERY_KEY } from "@/features/layout/hooks/use-ucat-profile";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";
import { useLeaveGuard } from "@/shared/hooks/use-leave-guard";
import { motion } from "motion/react";
import type { SocialAuthProvider } from "@/features/auth/lib/social-auth";
import { ConnectedSignInMethods } from "@/features/settings/components/connected-sign-in-methods";

const SETTINGS_LEAVE_MESSAGE =
  "You have unsaved settings. Leave this page without saving?";

export function SettingsProfilePage({
  enabledSocialProviders = [],
}: {
  enabledSocialProviders?: SocialAuthProvider[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { containerVariants, itemVariants } = useUcatStaggerMotion();
  const { user } = useAuth();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [savedFirstName, setSavedFirstName] = useState<string | null>(null);
  const [savedLastName, setSavedLastName] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [nameBusy, setNameBusy] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameMessage, setNameMessage] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    const res = await fetch("/api/ucat/profile");
    if (!res.ok) throw new Error("Failed to load profile");
    const data = (await res.json()) as {
      firstName?: string;
      lastName?: string;
    };
    const fn = data.firstName ?? "";
    const ln = data.lastName ?? "";
    setFirstName(fn);
    setLastName(ln);
    setSavedFirstName(fn);
    setSavedLastName(ln);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await loadProfile();
      } catch {
        if (!cancelled) {
          setNameError("Could not load your profile.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadProfile]);

  const namesDirty =
    savedFirstName !== null &&
    savedLastName !== null &&
    (firstName.trim() !== savedFirstName || lastName.trim() !== savedLastName);

  const emailDirty = newEmail.trim().length > 0;
  const isDirty = namesDirty || emailDirty;
  const dockBusy = nameBusy || emailBusy;
  useLeaveGuard(isDirty, SETTINGS_LEAVE_MESSAGE);

  const handleSaveNames = async (): Promise<boolean> => {
    setNameBusy(true);
    setNameError(null);
    setNameMessage(null);
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!fn || !ln) {
      toast({
        title: "Name required",
        description: "First and last name are required.",
        variant: "destructive",
      });
      setNameBusy(false);
      return false;
    }
    try {
      const res = await fetch("/api/ucat/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: fn, lastName: ln }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to save");
      }
      setSavedFirstName(fn);
      setSavedLastName(ln);
      setNameMessage("Saved.");
      await queryClient.invalidateQueries({ queryKey: UCAT_PROFILE_QUERY_KEY });
      router.refresh();
      return true;
    } catch (e) {
      toast({
        title: "Could not save name",
        description: e instanceof Error ? e.message : "Failed to save",
        variant: "destructive",
      });
      return false;
    } finally {
      setNameBusy(false);
    }
  };

  const handleEmailChange = async (): Promise<boolean> => {
    setEmailBusy(true);
    const next = newEmail.trim().toLowerCase();
    if (!next) {
      toast({
        title: "Email required",
        description: "Enter a new email address.",
        variant: "destructive",
      });
      setEmailBusy(false);
      return false;
    }
    if (user?.email && next === user.email.toLowerCase()) {
      toast({
        title: "Same email",
        description: "That is already your sign-in email.",
        variant: "destructive",
      });
      setEmailBusy(false);
      return false;
    }
    const origin = window.location.origin;
    const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent("/settings/profile")}`;
    const { error } = await supabase.auth.updateUser(
      { email: next },
      { emailRedirectTo },
    );
    if (error) {
      toast({
        title: "Could not update email",
        description: error.message ?? "Could not start email change.",
        variant: "destructive",
      });
      setEmailBusy(false);
      return false;
    }
    toast({
      title: "Confirmation sent",
      description:
        "Open the link in the email to finish updating your address.",
    });
    setNewEmail("");
    router.refresh();
    setEmailBusy(false);
    return true;
  };

  const handleSaveDirty = async () => {
    if (namesDirty) {
      const ok = await handleSaveNames();
      if (!ok) return;
    }
    if (emailDirty) {
      await handleEmailChange();
    }
  };

  const handleCancelDirty = () => {
    if (savedFirstName !== null) setFirstName(savedFirstName);
    if (savedLastName !== null) setLastName(savedLastName);
    setNewEmail("");
    setNameError(null);
    setNameMessage(null);
  };

  const handlePasswordChange = async () => {
    setPasswordBusy(true);
    setPasswordError(null);
    setPasswordMessage(null);
    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      setPasswordBusy(false);
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      setPasswordBusy(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setPasswordError(error.message ?? "Could not update password.");
    } else {
      setPasswordMessage("Password updated.");
      setPassword("");
      setConfirmPassword("");
      router.refresh();
    }
    setPasswordBusy(false);
  };

  if (loading) {
    return <AppPageSkeleton variant="detail" />;
  }

  const pendingEmail = user?.new_email?.trim();

  const saveLabel = (() => {
    if (dockBusy) {
      if (emailBusy && !nameBusy) return "Sending…";
      return "Saving…";
    }
    if (namesDirty && emailDirty) return "Save changes";
    if (emailDirty) return "Update email";
    return "Save name";
  })();

  return (
    <motion.div
      className={cn(
        "space-y-6",
        isDirty &&
          "pb-[max(6.5rem,calc(env(safe-area-inset-bottom,0px)+5rem))]",
      )}
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={itemVariants}>
        <UcatPageHeader
          title="My profile"
          description="Email, name, password, and sign-in methods"
          backHref="/settings"
          backLabel="All settings"
        />
      </motion.div>

      <motion.div
        variants={itemVariants}
        className={cn(
          "rounded-ucatShell p-6 sm:p-8",
          UCAT_SURFACE_CARD,
          UCAT_SURFACE_MOTION,
        )}
      >
        <ConnectedSignInMethods enabledProviders={enabledSocialProviders} />
      </motion.div>

      <motion.div
        variants={itemVariants}
        className={cn(
          "rounded-ucatShell p-6 sm:p-8",
          UCAT_SURFACE_CARD,
          UCAT_SURFACE_MOTION,
        )}
      >
        <SettingsRow
          title="Email"
          description="Sign-in address. Changing it sends a confirmation link to the new inbox; your current email stays active until you confirm."
          control={
            <div className="w-full space-y-3 sm:max-w-md">
              <div className="space-y-1.5">
                <Label
                  htmlFor="current-email"
                  className="text-muted-foreground"
                >
                  Current
                </Label>
                <Input
                  id="current-email"
                  type="email"
                  value={user?.email ?? ""}
                  disabled
                  className="bg-muted/50"
                />
              </div>
              {pendingEmail ? (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Pending change to{" "}
                  <span className="font-medium">{pendingEmail}</span>. Confirm
                  via the message sent to that address.
                </p>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="new-email">New email</Label>
                <Input
                  id="new-email"
                  type="email"
                  autoComplete="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
            </div>
          }
        />
      </motion.div>

      <motion.div
        variants={itemVariants}
        className={cn(
          "rounded-ucatShell p-6 sm:p-8",
          UCAT_SURFACE_CARD,
          UCAT_SURFACE_MOTION,
        )}
      >
        <SettingsRow
          title="Name"
          description="Shown on receipts and inside the app where we greet you."
          control={
            <div className="w-full space-y-3 sm:max-w-md">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="first-name">First name</Label>
                  <Input
                    id="first-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="given-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="last-name">Last name</Label>
                  <Input
                    id="last-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="family-name"
                  />
                </div>
              </div>
              {nameError ? (
                <p className="text-sm text-destructive">{nameError}</p>
              ) : null}
              {nameMessage ? (
                <p className="text-sm text-muted-foreground">{nameMessage}</p>
              ) : null}
            </div>
          }
        />
      </motion.div>

      <motion.div
        variants={itemVariants}
        className={cn(
          "rounded-ucatShell p-6 sm:p-8",
          UCAT_SURFACE_CARD,
          UCAT_SURFACE_MOTION,
        )}
      >
        <SettingsRow
          title="Password"
          description="Pick a strong password you have not used elsewhere."
          control={
            <div className="w-full space-y-3 sm:max-w-md">
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              {passwordError ? (
                <p className="text-sm text-destructive">{passwordError}</p>
              ) : null}
              {passwordMessage ? (
                <p className="text-sm text-muted-foreground">
                  {passwordMessage}
                </p>
              ) : null}
              <Button
                type="button"
                className="w-full sm:w-auto"
                onClick={() => void handlePasswordChange()}
                disabled={passwordBusy}
              >
                {passwordBusy ? "Updating…" : "Update password"}
              </Button>
            </div>
          }
        />
      </motion.div>

      <AppShellBottomFloatingDock visible={isDirty}>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancelDirty}
            disabled={dockBusy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSaveDirty()}
            disabled={dockBusy}
          >
            {saveLabel}
          </Button>
        </div>
      </AppShellBottomFloatingDock>
    </motion.div>
  );
}
