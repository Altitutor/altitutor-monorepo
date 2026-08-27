"use client";

import { useRef, useState, type FormEvent } from "react";
import { MARKETING_TOKENS } from "@altitutor/shared";
import { UCAT_BODY_DESCRIPTION_CLASS, UCAT_SUPPORTING_TEXT_CLASS } from "./ucat-landing-section-eyebrow";
import {
  PhoneInput,
  isPhoneCountryCodeOnly,
  validateOptionalPhoneE164,
} from "@altitutor/ui";
import clsx from "clsx";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { AnalyticsLink } from "../analytics-link";
import { PRODUCT_LINKS } from "@/lib/site";
import { MagneticButton } from "./magnetic-button";
import {
  type UcatInterestKind,
  isSupportedAccessKind,
} from "./ucat-interest-kind";

const { typography: typo } = MARKETING_TOKENS;

const supportedAccessFormHeightClass = "min-h-[32rem]";
const waitlistFormHeightClass = "min-h-[24rem]";

function formHeightClass(kind: UcatInterestKind) {
  return isSupportedAccessKind(kind)
    ? supportedAccessFormHeightClass
    : waitlistFormHeightClass;
}

function interestCopy(kind: UcatInterestKind) {
  if (isSupportedAccessKind(kind)) {
    return {
      successTitle: "Application received",
      successBody:
        "Thank you. The Altitutor team will review your application and contact you if supported access is suitable.",
      successPlacement: "supported_access_success" as const,
      formLabel: "Supported access application",
      submitLabel: "Submit application",
    };
  }

  if (kind === "interview_training_waitlist") {
    return {
      successTitle: "You are on the waitlist",
      successBody:
        "Thank you. We will contact you when medical interview course places are released.",
      successPlacement: "interview_waitlist_success" as const,
      formLabel: "Interview training waitlist",
      submitLabel: "Join the waitlist",
    };
  }

  return {
    successTitle: "You are on the waitlist",
    successBody:
      "Thank you. We will contact you when online tutoring places become available.",
    successPlacement: "tutoring_waitlist_success" as const,
    formLabel: "Online tutoring waitlist",
    submitLabel: "Join the waitlist",
  };
}

const phoneInputClassName = clsx(
  "[&_.PhoneInputInput]:mt-1.5 [&_.PhoneInputInput]:h-auto [&_.PhoneInputInput]:rounded-xl [&_.PhoneInputInput]:border-marketing-charcoal/12 [&_.PhoneInputInput]:bg-white [&_.PhoneInputInput]:px-4 [&_.PhoneInputInput]:py-3 [&_.PhoneInputInput]:text-sm [&_.PhoneInputInput]:text-marketing-charcoal [&_.PhoneInputInput]:placeholder:text-marketing-charcoal/40 [&_.PhoneInputInput]:focus-visible:border-marketing-primary [&_.PhoneInputInput]:focus-visible:ring-2 [&_.PhoneInputInput]:focus-visible:ring-marketing-primary/12",
  "[&>p:last-child]:text-marketing-charcoal/65",
);

const phoneCountryClassName =
  "[&_button]:mt-1.5 [&_button]:h-auto [&_button]:rounded-xl [&_button]:border-marketing-charcoal/12 [&_button]:bg-white [&_button]:px-3 [&_button]:py-3 [&_button]:text-sm [&_button]:text-marketing-charcoal [&_button]:focus-visible:ring-marketing-primary/12";

const fieldClass =
  "mt-1.5 block w-full rounded-xl border border-marketing-charcoal/12 bg-white px-4 py-3 text-sm text-marketing-charcoal outline-none transition focus:border-marketing-primary focus:ring-2 focus:ring-marketing-primary/12";

function InterestFormSuccess({
  kind,
  successBody,
}: {
  kind: UcatInterestKind;
  successBody?: string;
}) {
  const reduceMotion = useReducedMotion();
  const copy = interestCopy(kind);
  const isSupportedAccess = isSupportedAccessKind(kind);
  const resolvedSuccessBody = successBody ?? copy.successBody;

  return (
    <div
      className={`flex ${formHeightClass(kind)} flex-col items-center justify-center px-2 text-center`}
    >
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, scale: 0.82 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 260, damping: 22 }
        }
        className="flex size-20 items-center justify-center rounded-full bg-marketing-primary/10 ring-1 ring-marketing-primary/10"
      >
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { delay: 0.12, type: "spring", stiffness: 320, damping: 20 }
          }
        >
          <CheckCircle2 className="size-10 text-marketing-primary" aria-hidden />
        </motion.div>
      </motion.div>

      <motion.h4
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { delay: 0.18, duration: 0.35 }}
        className={`mt-6 text-2xl font-semibold tracking-tight text-marketing-charcoal ${typo.headingSans}`}
      >
        {copy.successTitle}
      </motion.h4>

      <motion.p
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { delay: 0.26, duration: 0.35 }}
        className={`mt-3 max-w-sm ${UCAT_BODY_DESCRIPTION_CLASS} ${typo.secondarySans}`}
      >
        {resolvedSuccessBody}
      </motion.p>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { delay: 0.34, duration: 0.35 }}
        className="mt-8 w-full max-w-sm"
      >
        <p
          className={`mb-4 ${UCAT_SUPPORTING_TEXT_CLASS} ${typo.secondarySans}`}
        >
          {isSupportedAccess
            ? "While we process your application, you can start preparing with free UCAT access."
            : "While you wait, you can start preparing with free UCAT access."}
        </p>
        <AnalyticsLink
          href={PRODUCT_LINKS.ucatSignup}
          analytics={{
            product: "ucat",
            placement: copy.successPlacement,
            action: "start_free",
          }}
          className="inline-flex w-full"
        >
          <MagneticButton className="w-full bg-marketing-primary px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-marketing-primary/15">
            Start preparing free <ArrowRight className="size-4" aria-hidden />
          </MagneticButton>
        </AnalyticsLink>
      </motion.div>
    </div>
  );
}

export function UcatInterestForm({
  kind,
  successBody,
}: {
  kind: UcatInterestKind;
  successBody?: string;
}) {
  const startedAt = useRef(Date.now());
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const copy = interestCopy(kind);
  const isSupportedAccess = isSupportedAccessKind(kind);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setState("submitting");
    setMessage("");
    setPhoneError(null);

    if (!phone.trim() || isPhoneCountryCodeOnly(phone)) {
      setState("idle");
      setPhoneError("Please enter your phone number.");
      return;
    }

    const phoneResult = validateOptionalPhoneE164(phone);
    if (phoneResult.error || !phoneResult.phone) {
      setState("idle");
      setPhoneError(phoneResult.error ?? "Please enter a valid phone number.");
      return;
    }

    const form = new FormData(formElement);
    const firstName = String(form.get("firstName") ?? "").trim();
    const lastName = String(form.get("lastName") ?? "").trim();
    const name = `${firstName} ${lastName}`.trim();

    if (firstName.length < 1 || lastName.length < 1) {
      setState("error");
      setMessage("Please enter your first and last name.");
      return;
    }

    try {
      const response = await fetch("/api/ucat/interest/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          name,
          email: form.get("email"),
          phone: phoneResult.phone,
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
    setPhone("");
    setPhoneError(null);
  }

  if (state === "success") {
    return <InterestFormSuccess kind={kind} successBody={successBody} />;
  }

  return (
    <form
      onSubmit={submit}
      className={`grid ${formHeightClass(kind)} content-start gap-4`}
      aria-label={copy.formLabel}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={`text-sm font-medium text-marketing-charcoal ${typo.secondarySans}`}>
          First name
          <input
            name="firstName"
            autoComplete="given-name"
            required
            minLength={1}
            maxLength={60}
            className={fieldClass}
          />
        </label>
        <label className={`text-sm font-medium text-marketing-charcoal ${typo.secondarySans}`}>
          Last name
          <input
            name="lastName"
            autoComplete="family-name"
            required
            minLength={1}
            maxLength={60}
            className={fieldClass}
          />
        </label>
      </div>
      <label className={`text-sm font-medium text-marketing-charcoal ${typo.secondarySans}`}>
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={320}
          className={fieldClass}
        />
      </label>
      <div>
        <label
          className={`text-sm font-medium text-marketing-charcoal ${typo.secondarySans}`}
        >
          Phone number
        </label>
        <PhoneInput
          value={phone}
          onChange={(value) => {
            setPhone(value);
            if (phoneError) setPhoneError(null);
          }}
          placeholder="4xx xxx xxx"
          disabled={state === "submitting"}
          error={phoneError ?? undefined}
          countrySelectClassName={phoneCountryClassName}
          className={clsx(phoneInputClassName, typo.secondarySans)}
        />
      </div>
      {isSupportedAccess ? (
        <label className={`text-sm font-medium text-marketing-charcoal ${typo.secondarySans}`}>
          Why are you applying?
          <textarea
            name="reason"
            required
            minLength={20}
            maxLength={3000}
            rows={5}
            className={`${fieldClass} resize-y`}
            placeholder="Tell us about your financial circumstances and how supported access would help."
          />
        </label>
      ) : null}
      <label className="absolute -left-[10000px]" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <p className={`${UCAT_SUPPORTING_TEXT_CLASS} ${typo.secondarySans}`}>
        By submitting, you are consenting to Altitutor contacting you about this{" "}
        {isSupportedAccess ? "application" : "waitlist"}.
      </p>
      {state === "error" ? (
        <p role="alert" className="text-sm text-red-700">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={state === "submitting"}
        className="inline-flex w-full disabled:cursor-wait disabled:opacity-65"
      >
        <MagneticButton
          className={`w-full bg-marketing-primary px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-marketing-primary/15 ${typo.secondarySans}`}
        >
          {state === "submitting" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <ArrowRight className="size-4" aria-hidden />
          )}
          {state === "submitting" ? "Sending…" : copy.submitLabel}
        </MagneticButton>
      </button>
    </form>
  );
}
