"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Input } from "@altitutor/ui";
import { X } from "lucide-react";
import { EmailParticipant } from "./EmailParticipant";
import { mailRequest } from "../api/client";
const personSchema = z.object({
  id: z.string(),
  type: z.enum(["student", "parent", "staff"]),
  label: z.string(),
  email: z.string(),
});
export function EmailRecipients({
  label,
  value,
  onChange,
  disabled,
  threadId = "",
  mailboxAddress = "",
  beforeLink,
  onPendingChange,
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  disabled: boolean;
  onNavigate?: (next: () => void) => void;
  threadId?: string;
  mailboxAddress?: string;
  beforeLink?: () => Promise<string | undefined>;
  onPendingChange?: (pending: boolean) => void;
}) {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    onPendingChange?.(Boolean(input.trim()));
  }, [input, onPendingChange]);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(input.trim()), 150);
    return () => clearTimeout(timer);
  }, [input]);
  const options = useQuery({
    queryKey: ["email", "recipients", search],
    enabled: search.length >= 2,
    queryFn: async () =>
      z
        .object({ people: z.array(personSchema) })
        .parse(
          await mailRequest(`/recipients?q=${encodeURIComponent(search)}`),
        ),
    staleTime: 60_000,
  });
  const suggestions = (options.data?.people ?? []).filter(
    (person) => !value.includes(person.email),
  );
  function commit(text: string) {
    const entries = text
      .split(/[,;\n]/)
      .map((address) => address.trim().toLowerCase())
      .filter(Boolean);
    if (!entries.length) return;
    if (
      entries.some((address) => !z.string().email().safeParse(address).success)
    ) {
      setError("Enter a valid email address.");
      return;
    }
    onChange([...new Set([...value, ...entries])]);
    setInput("");
    setError("");
  }
  return (
    <div className="relative min-w-0 flex-1">
      <div className="flex min-h-9 flex-wrap items-center gap-1">
        {value.map((email) => (
          <span
            key={email}
            className="inline-flex max-w-full items-center gap-0.5 rounded-md bg-muted"
            title={email}
          >
            <EmailParticipant
              email={email}
              label={email}
              threadId={threadId}
              mailboxAddress={mailboxAddress}
              beforeLink={beforeLink}
            />
            <button
              type="button"
              aria-label={`Remove ${email}`}
              title={`Remove ${email}`}
              disabled={disabled}
              className="rounded p-1 hover:bg-muted-foreground/10"
              onClick={() => onChange(value.filter((item) => item !== email))}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <Input
          aria-label={label}
          value={input}
          disabled={disabled}
          placeholder={
            value.length ? "Add recipient…" : "Name or email address"
          }
          className="h-9 min-w-32 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            if (input.trim()) commit(input);
          }}
          onChange={(event) => {
            const text = event.target.value;
            if (/[,;]$/.test(text)) commit(text);
            else setInput(text);
          }}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" ||
              (event.key === "Tab" && input.trim())
            ) {
              event.preventDefault();
              const currentSuggestions =
                search === input.trim() ? suggestions : [];
              const match =
                currentSuggestions.find(
                  (person) => person.email === input.trim().toLowerCase(),
                ) ??
                (z.string().email().safeParse(input.trim()).success
                  ? undefined
                  : currentSuggestions[0]);
              commit(match?.email ?? input);
            }
            if (event.key === "Backspace" && !input && value.length)
              onChange(value.slice(0, -1));
            if (event.key === "Escape") setFocused(false);
          }}
        />
      </div>
      {focused && search.length >= 2 && input.trim() && (
        <div
          role="listbox"
          aria-label={`${label} suggestions`}
          className="absolute left-0 top-full z-50 max-h-52 w-full min-w-60 overflow-auto rounded-md border bg-popover p-1 shadow-md"
        >
          {suggestions.map((person) => (
            <button
              type="button"
              role="option"
              aria-selected={false}
              key={`${person.type}:${person.id}`}
              className="flex w-full flex-col rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => commit(person.email)}
            >
              <span>
                {person.label}{" "}
                <span className="text-xs text-muted-foreground">
                  · {person.type}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">
                {person.email}
              </span>
            </button>
          ))}
          {!suggestions.length && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              {options.isFetching
                ? "Searching contacts…"
                : options.error
                  ? "Contact search unavailable. Enter an email address."
                  : "Press Enter to use this email address"}
            </p>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
