"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

export function UcatInterestForm({
  kind,
}: {
  kind: "supported_access" | "online_tutoring_waitlist";
}) {
  const startedAt = useRef(Date.now());
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const isSupportedAccess = kind === "supported_access";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setState("submitting");
    setMessage("");
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/ucat/interest/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone"),
          reason: form.get("reason"),
          website: form.get("website"),
          startedAt: startedAt.current,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setState("error");
        setMessage(result.error ?? "Something went wrong. Please try again.");
        return;
      }
    } catch {
      setState("error");
      setMessage("We could not reach Altitutor. Please try again.");
      return;
    }
    setState("success");
    formElement.reset();
  }

  if (state === "success") {
    return (
      <div className="rounded-2xl bg-white p-6 text-marketing-charcoal shadow-sm ring-1 ring-marketing-charcoal/10">
        <CheckCircle2 className="size-6 text-marketing-primary" aria-hidden />
        <h4 className="mt-4 text-lg font-semibold">
          {isSupportedAccess ? "Application received" : "You are on the waitlist"}
        </h4>
        <p className="mt-2 text-sm leading-relaxed text-marketing-charcoal/60">
          The Altitutor team will follow up using the details you provided.
        </p>
      </div>
    );
  }

  const fieldClass =
    "mt-1.5 block w-full rounded-xl border border-marketing-charcoal/12 bg-white px-4 py-3 text-sm text-marketing-charcoal outline-none transition focus:border-marketing-primary focus:ring-2 focus:ring-marketing-primary/12";

  return (
    <form onSubmit={submit} className="grid gap-4" aria-label={isSupportedAccess ? "Supported access application" : "Online tutoring waitlist"}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-marketing-charcoal">
          Name
          <input name="name" autoComplete="name" required minLength={2} maxLength={120} className={fieldClass} />
        </label>
        <label className="text-sm font-medium text-marketing-charcoal">
          Email
          <input name="email" type="email" autoComplete="email" required maxLength={320} className={fieldClass} />
        </label>
      </div>
      <label className="text-sm font-medium text-marketing-charcoal">
        Phone number
        <input name="phone" type="tel" autoComplete="tel" required minLength={6} maxLength={40} className={fieldClass} />
      </label>
      {isSupportedAccess ? (
        <label className="text-sm font-medium text-marketing-charcoal">
          Why are you applying?
          <textarea name="reason" required minLength={20} maxLength={3000} rows={5} className={`${fieldClass} resize-y`} placeholder="Tell us about your financial circumstances and how supported access would help." />
        </label>
      ) : null}
      <label className="absolute -left-[10000px]" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <p className="text-xs leading-relaxed text-marketing-charcoal/48">
        By submitting, you are asking Altitutor to contact you about this {isSupportedAccess ? "application" : "waitlist"}. This does not subscribe you to general marketing emails.
      </p>
      {state === "error" ? <p role="alert" className="text-sm text-red-700">{message}</p> : null}
      <button
        type="submit"
        disabled={state === "submitting"}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-marketing-primary px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-marketing-charcoal disabled:cursor-wait disabled:opacity-65"
      >
        {state === "submitting" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ArrowRight className="size-4" aria-hidden />}
        {state === "submitting" ? "Sending…" : isSupportedAccess ? "Submit application" : "Join the waitlist"}
      </button>
    </form>
  );
}
