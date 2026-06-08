"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@altitutor/ui";
import { AppShellBottomFloatingDock, UcatPageHeader } from "@/features/layout";
import { useAuth } from "@/features/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { UCAT_SURFACE_CARD, UCAT_SURFACE_MOTION } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { SettingsRow } from "@/features/settings/components/settings-row";
import { UCAT_PROFILE_QUERY_KEY } from "@/features/layout/hooks/use-ucat-profile";

export function SettingsProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [savedFirstName, setSavedFirstName] = useState<string | null>(null);
  const [savedLastName, setSavedLastName] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

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

  const handleSaveNames = async () => {
    setNameBusy(true);
    setNameError(null);
    setNameMessage(null);
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!fn || !ln) {
      setNameError("First and last name are required.");
      setNameBusy(false);
      return;
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
    } catch (e) {
      setNameError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setNameBusy(false);
    }
  };

  const handleEmailChange = async () => {
    setEmailBusy(true);
    setEmailError(null);
    setEmailMessage(null);
    const next = newEmail.trim().toLowerCase();
    if (!next) {
      setEmailError("Enter a new email address.");
      setEmailBusy(false);
      return;
    }
    if (user?.email && next === user.email.toLowerCase()) {
      setEmailError("That is already your sign-in email.");
      setEmailBusy(false);
      return;
    }
    const origin = window.location.origin;
    const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent("/settings/profile")}`;
    const { error } = await supabase.auth.updateUser({ email: next }, { emailRedirectTo });
    if (error) {
      setEmailError(error.message ?? "Could not start email change.");
    } else {
      setEmailMessage(
        "Confirmation sent. Open the link in the email to finish updating your address.",
      );
      setNewEmail("");
      router.refresh();
    }
    setEmailBusy(false);
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
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="My profile"
          description="Email, name, and password"
          backHref="/settings"
          backLabel="All settings"
        />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const pendingEmail = user?.new_email?.trim();

  return (
    <div
      className={cn(
        "space-y-6",
        namesDirty &&
          "pb-[max(6.5rem,calc(env(safe-area-inset-bottom,0px)+5rem))]",
      )}
    >
      <UcatPageHeader
        title="My profile"
        description="Email, name, and password"
        backHref="/settings"
        backLabel="All settings"
      />

      <div className={cn("rounded-ucatShell p-6 sm:p-8", UCAT_SURFACE_CARD, UCAT_SURFACE_MOTION)}>
        <SettingsRow
          title="Email"
          description="Sign-in address. Changing it sends a confirmation link to the new inbox; your current email stays active until you confirm."
          control={
            <div className="w-full space-y-3 sm:max-w-md">
              <div className="space-y-1.5">
                <Label htmlFor="current-email" className="text-muted-foreground">
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
                  Pending change to <span className="font-medium">{pendingEmail}</span>. Confirm
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
              {emailError ? <p className="text-sm text-destructive">{emailError}</p> : null}
              {emailMessage ? <p className="text-sm text-muted-foreground">{emailMessage}</p> : null}
              <Button
                type="button"
                className="w-full sm:w-auto"
                onClick={() => void handleEmailChange()}
                disabled={emailBusy}
              >
                {emailBusy ? "Sending…" : "Update email"}
              </Button>
            </div>
          }
        />
      </div>

      <div className={cn("rounded-ucatShell p-6 sm:p-8", UCAT_SURFACE_CARD, UCAT_SURFACE_MOTION)}>
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
              {nameError ? <p className="text-sm text-destructive">{nameError}</p> : null}
              {nameMessage ? <p className="text-sm text-muted-foreground">{nameMessage}</p> : null}
            </div>
          }
        />
      </div>

      <div className={cn("rounded-ucatShell p-6 sm:p-8", UCAT_SURFACE_CARD, UCAT_SURFACE_MOTION)}>
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
              {passwordError ? <p className="text-sm text-destructive">{passwordError}</p> : null}
              {passwordMessage ? (
                <p className="text-sm text-muted-foreground">{passwordMessage}</p>
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
      </div>

      {namesDirty ? (
        <AppShellBottomFloatingDock visible>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (savedFirstName !== null) setFirstName(savedFirstName);
                if (savedLastName !== null) setLastName(savedLastName);
                setNameError(null);
                setNameMessage(null);
              }}
              disabled={nameBusy}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSaveNames()} disabled={nameBusy}>
              {nameBusy ? "Saving…" : "Save name"}
            </Button>
          </div>
        </AppShellBottomFloatingDock>
      ) : null}
    </div>
  );
}
