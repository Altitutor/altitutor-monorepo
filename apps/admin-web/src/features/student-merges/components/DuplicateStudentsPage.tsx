"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Input } from "@altitutor/ui";
import Link from "next/link";
import { mergeRead, mergeRequest } from "../api";
import {
  conflictingFields,
  displayValue,
  fieldLabel,
  MERGE_FIELDS,
  type DuplicateCandidate,
  type MergePreview,
} from "../types";

type StudentOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

function StudentPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setTerm(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const results = useQuery({
    queryKey: ["student-merge-search", term],
    queryFn: ({ signal }) =>
      mergeRead<StudentOption[]>(`?search=${encodeURIComponent(term)}`, signal),
    enabled: term.trim().length >= 2,
  });
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">
        {label}
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            onChange("");
          }}
          placeholder="Search by name or email"
        />
      </label>
      {results.error && <p role="alert">{results.error.message}</p>}
      <select
        aria-label={`Choose ${label.toLowerCase()}`}
        className="w-full rounded-md border bg-background p-2"
        value={value}
        disabled={results.isFetching || search !== term}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Choose a student</option>
        {(results.data ?? []).map((student) => (
          <option key={student.id} value={student.id}>
            {student.first_name} {student.last_name} —{" "}
            {student.email || student.id.slice(0, 8)}
          </option>
        ))}
      </select>
    </div>
  );
}

function MergeReview({
  retainedId,
  sourceId,
  onClose,
  onComplete,
}: {
  retainedId: string;
  sourceId: string;
  onClose: () => void;
  onComplete: (id: string) => void;
}) {
  const [retained, setRetained] = useState(retainedId);
  const [source, setSource] = useState(sourceId);
  const [fields, setFields] = useState<Record<string, "retained" | "source">>(
    {},
  );
  const [showAllDetails, setShowAllDetails] = useState(false);
  const [login, setLogin] = useState("");
  const [billing, setBilling] = useState("");
  const [samePerson, setSamePerson] = useState(false);
  const [parentsReviewed, setParentsReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const preview = useQuery({
    queryKey: ["student-merge-preview", retained, source],
    queryFn: () =>
      mergeRequest<MergePreview>({ action: "preview", retained, source }),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const kept = preview.data?.students.find(
    (student) => student.id === retained,
  );
  const removed = preview.data?.students.find(
    (student) => student.id === source,
  );
  if (preview.isPending) return <p role="status">Loading merge preview…</p>;
  if (preview.error || !kept || !removed || !preview.data)
    return (
      <div>
        <p role="alert">{preview.error?.message || "Could not load preview"}</p>
        <Button onClick={onClose}>Back</Button>
      </div>
    );
  const data = preview.data;
  const conflicts = conflictingFields(kept, removed);
  const logins = data.students.filter((student) => student.user_id);
  const billingOptions = data.students.filter((student) => student.billing);
  const chosenLogin = login || (logins.length === 1 ? logins[0].user_id : null);
  const chosenBilling =
    billing || (billingOptions.length === 1 ? billingOptions[0].id : null);
  const ready =
    samePerson &&
    parentsReviewed &&
    conflicts.every((field) => fields[field]) &&
    (!logins.length || chosenLogin) &&
    (!billingOptions.length || chosenBilling) &&
    !data.blockers.length;
  async function submit() {
    if (!ready) return;
    setBusy(true);
    setError("");
    try {
      const id = await mergeRequest<string>({
        action: "merge",
        retained,
        source,
        fingerprint: data.fingerprint,
        choices: {
          fields,
          login_user_id: chosenLogin,
          billing_student_id: chosenBilling,
          confirmed_same_person: true,
          reviewed_parent_access: true,
        },
      });
      onComplete(id);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Merge failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="space-y-6 rounded-lg border p-5"
      aria-label="Merge preview"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Review the combined student</h2>
        <Button variant="outline" disabled={busy} onClick={onClose}>
          Back to candidates
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Keep one student record, bring across the other record’s history, and
        choose how the student signs in and is billed. The original records are
        preserved in the merge audit.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {[kept, removed].map((student, index) => (
          <div key={student.id} className="rounded-md border p-4 space-y-2">
            <p className="text-sm font-medium">
              {index === 0 ? "Retained student" : "Merge into retained student"}
            </p>
            <h3 className="font-semibold">
              {student.first_name} {student.last_name}
            </h3>
            <p className="text-sm">
              {student.email || "No email"} · {student.phone || "No phone"}
            </p>
            <p className="text-sm">
              In-person: {student.status || "None"} · Created{" "}
              {student.created_at
                ? new Date(student.created_at).toLocaleDateString()
                : "Unknown"}
            </p>
            <p className="text-sm">
              Sign-in: {student.login_email}{" "}
              {student.sign_in_methods.join(", ") || "No login"}
            </p>
            <Link
              className="text-sm underline"
              href={`/students/${student.id}`}
              target="_blank"
            >
              Open full student record
            </Link>
          </div>
        ))}
      </div>
      <p className="text-sm">
        Recommended retained record:{" "}
        {[kept, removed].sort(
          (a, b) =>
            Number(Boolean(b.registered_at)) * 4 +
              Number(Boolean(b.billing)) * 2 -
              (Number(Boolean(a.registered_at)) * 4 +
                Number(Boolean(a.billing)) * 2) ||
            (a.created_at ?? "").localeCompare(b.created_at ?? ""),
        )[0].id === retained
          ? "the currently retained record"
          : "the other record"}
        . Prefer the established registration and billing history; the login can
        be chosen independently.
      </p>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => {
          setRetained(source);
          setSource(retained);
          setFields({});
          setLogin("");
          setBilling("");
          setSamePerson(false);
          setParentsReviewed(false);
          setError("");
        }}
      >
        Swap retained student
      </Button>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="text-left font-medium mb-2">
            Resulting details — choose a value wherever both records disagree
          </caption>
          <thead>
            <tr className="border-b">
              <th className="p-2 text-left">Detail</th>
              <th className="p-2 text-left">Retained record</th>
              <th className="p-2 text-left">Other record</th>
              <th className="p-2 text-left">Keep</th>
            </tr>
          </thead>
          <tbody>
            {MERGE_FIELDS.filter(
              (field) =>
                (kept[field] != null || removed[field] != null) &&
                (showAllDetails ||
                  conflicts.includes(field) ||
                  [
                    "first_name",
                    "last_name",
                    "email",
                    "phone",
                    "school",
                    "curriculum",
                    "year_level",
                    "birthday",
                    "status",
                    "account_class",
                  ].includes(field)),
            ).map((field) => (
              <tr className="border-b" key={field}>
                <th className="p-2 text-left font-normal">
                  {fieldLabel(field)}
                </th>
                <td className="p-2 max-w-64 break-words">
                  {displayValue(kept[field])}
                </td>
                <td className="p-2 max-w-64 break-words">
                  {displayValue(removed[field])}
                </td>
                <td className="p-2">
                  {conflicts.includes(field) ? (
                    <select
                      disabled={busy}
                      aria-label={`Keep ${fieldLabel(field)}`}
                      className="rounded border bg-background p-2"
                      value={fields[field] || ""}
                      onChange={(event) => {
                        const value = event.target.value;
                        setFields((previous) => {
                          const next = { ...previous };
                          if (value === "retained" || value === "source") {
                            next[field] = value;
                            if (field === "status") {
                              for (const lifecycleField of [
                                "registered_at",
                                "active_at",
                                "discontinued_at",
                                "discontinued_by",
                              ])
                                next[lifecycleField] = value;
                            }
                          } else delete next[field];
                          return next;
                        });
                      }}
                    >
                      <option value="">Choose…</option>
                      <option value="retained">Retained record</option>
                      <option value="source">Other record</option>
                    </select>
                  ) : (
                    displayValue(
                      fields[field] === "source"
                        ? removed[field]
                        : fields[field] === "retained"
                          ? kept[field]
                          : (kept[field] ?? removed[field]),
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button
        variant="outline"
        onClick={() => setShowAllDetails((value) => !value)}
      >
        {showAllDetails ? "Show key details only" : "Show all details"}
      </Button>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="block font-medium">Retained login</span>
          <select
            disabled={busy || !logins.length}
            aria-label="Retained login"
            value={chosenLogin || ""}
            onChange={(event) => setLogin(event.target.value)}
            className="w-full rounded border bg-background p-2"
          >
            <option value="">
              {logins.length ? "Choose a login" : "Neither record has a login"}
            </option>
            {logins.map((student) => (
              <option key={student.id} value={student.user_id ?? ""}>
                {student.login_email || student.id.slice(0, 8)} —{" "}
                {student.sign_in_methods.join(", ")}
              </option>
            ))}
          </select>
          <span className="block text-sm text-muted-foreground">
            Other logins lose access to this student. Their unrelated roles
            remain. Connecting additional sign-in methods is a separate
            student-assisted process. Changing the contact email above does not
            change the login email.
          </span>
        </label>
        <label className="space-y-2">
          <span className="block font-medium">Billing for future charges</span>
          <select
            disabled={busy || !billingOptions.length}
            aria-label="Billing setup"
            value={chosenBilling || ""}
            onChange={(event) => setBilling(event.target.value)}
            className="w-full rounded border bg-background p-2"
          >
            <option value="">
              {billingOptions.length
                ? "Choose billing setup"
                : "Neither record has billing"}
            </option>
            {billingOptions.map((student) => (
              <option key={student.id} value={student.id}>
                {student.id === retained ? "Retained record" : "Other record"} —{" "}
                {student.billing?.stripe_customer_id}
                {student.saved_cards
                  .map((card) => ` · ${card.brand} ending ${card.last4}`)
                  .join("")}
              </option>
            ))}
          </select>
          <span className="block text-sm text-muted-foreground">
            Historical invoices remain linked. The chosen setup keeps its
            auto-billing and invoice-recipient settings; cards are not moved
            between customers.
          </span>
        </label>
      </div>
      <div className="space-y-2">
        <h3 className="font-medium">Parent access after merging</h3>
        <ul className="list-disc pl-5">
          {Array.from(
            new Map(
              [...kept.parents, ...removed.parents].map((parent) => [
                parent.id,
                parent,
              ]),
            ).values(),
          ).map((parent) => (
            <li key={parent.id}>{parent.name}</li>
          ))}
        </ul>
        {!kept.parents.length && !removed.parents.length && (
          <p className="text-sm">No parents linked.</p>
        )}
        <p className="text-sm text-muted-foreground">
          These parents will be linked to the combined student. Correct any
          unwanted links before merging.
        </p>
      </div>
      <details>
        <summary className="cursor-pointer font-medium">
          History included in this merge
        </summary>
        <ul className="mt-2 grid gap-1 text-sm md:grid-cols-2">
          {Object.entries(data.counts)
            .filter(([, count]) => count > 0)
            .map(([key, count]) => (
              <li key={key}>
                {fieldLabel(key.split(".")[0])}: {count}
              </li>
            ))}
        </ul>
      </details>
      <p className="text-sm text-muted-foreground">
        Old registration and calendar links will stop working. New links can be
        issued after the merge. This operation has an audit trail, but no
        one-click undo.
      </p>
      {data.blockers.map((blocker) => (
        <p key={blocker} role="alert" className="text-destructive">
          {blocker}
        </p>
      ))}
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          disabled={busy}
          checked={samePerson}
          onChange={(event) => setSamePerson(event.target.checked)}
        />
        I have confirmed that these records represent the same person.
      </label>
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          disabled={busy}
          checked={parentsReviewed}
          onChange={(event) => setParentsReviewed(event.target.checked)}
        />
        I have reviewed the parent access and resulting details.
      </label>
      {error && (
        <div role="alert" className="space-y-2">
          <p className="text-destructive">{error}</p>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              setSamePerson(false);
              setParentsReviewed(false);
              void preview.refetch();
            }}
          >
            Refresh preview
          </Button>
        </div>
      )}
      <Button disabled={!ready || busy} onClick={() => void submit()}>
        {busy ? "Merging…" : "Confirm student merge"}
      </Button>
    </section>
  );
}

export function DuplicateStudentsPage({ studentId }: { studentId?: string }) {
  const queryClient = useQueryClient();
  const [pair, setPair] = useState<{ retained: string; source: string } | null>(
    null,
  );
  const [manualA, setManualA] = useState("");
  const [manualB, setManualB] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dismissing, setDismissing] = useState("");
  const candidates = useQuery({
    queryKey: ["student-duplicates", studentId],
    queryFn: ({ signal }) =>
      mergeRead<DuplicateCandidate[]>(
        studentId ? `?student=${encodeURIComponent(studentId)}` : "",
        signal,
      ),
  });
  async function dismiss(candidate: DuplicateCandidate) {
    setDismissing(candidate.a_id + candidate.b_id);
    setError("");
    try {
      await mergeRequest({
        action: "dismiss",
        a: candidate.a_id,
        b: candidate.b_id,
        fingerprint: candidate.fingerprint,
      });
      await queryClient.invalidateQueries({ queryKey: ["student-duplicates"] });
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Could not dismiss",
      );
    } finally {
      setDismissing("");
    }
  }
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Duplicate students</h1>
        <p className="mt-2 text-muted-foreground">
          Review possible matches and combine records only after confirming they
          belong to the same person.
        </p>
      </div>
      {success && (
        <p role="status" className="rounded border p-3">
          Students merged.{" "}
          <Link className="underline" href={`/students/${success}`}>
            Open the combined student
          </Link>
        </p>
      )}
      {pair ? (
        <MergeReview
          key={`${pair.retained}:${pair.source}`}
          retainedId={pair.retained}
          sourceId={pair.source}
          onClose={() => setPair(null)}
          onComplete={(id) => {
            setPair(null);
            setSuccess(id);
            void queryClient.invalidateQueries();
          }}
        />
      ) : (
        <>
          {studentId && (
            <Link className="underline" href="/settings/duplicate-students">
              Show all candidates
            </Link>
          )}
          {(error || candidates.error) && (
            <p role="alert" className="text-destructive">
              {error || candidates.error?.message}
            </p>
          )}
          {candidates.isPending && (
            <p role="status">Finding possible duplicates…</p>
          )}
          {candidates.data?.length === 0 && (
            <p>
              No matching candidates. You can still compare two students
              manually below.
            </p>
          )}
          <div className="space-y-3">
            {candidates.data?.map((candidate) => (
              <article
                className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4"
                key={candidate.a_id + candidate.b_id}
              >
                <div>
                  <h2 className="font-medium">
                    {candidate.a_name} / {candidate.b_name}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {candidate.reasons.join(" · ")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setSuccess("");
                      setPair({
                        retained: candidate.a_id,
                        source: candidate.b_id,
                      });
                    }}
                  >
                    Review
                  </Button>
                  <Button
                    variant="outline"
                    disabled={Boolean(dismissing)}
                    onClick={() => void dismiss(candidate)}
                  >
                    {dismissing === candidate.a_id + candidate.b_id
                      ? "Saving…"
                      : "Keep separate"}
                  </Button>
                </div>
              </article>
            ))}
          </div>
          <section className="space-y-4 rounded-lg border p-4">
            <h2 className="font-medium">Compare students manually</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <StudentPicker
                label="First student"
                value={manualA}
                onChange={setManualA}
              />
              <StudentPicker
                label="Second student"
                value={manualB}
                onChange={setManualB}
              />
            </div>
            <Button
              disabled={!manualA || !manualB || manualA === manualB}
              onClick={() => setPair({ retained: manualA, source: manualB })}
            >
              Compare selected students
            </Button>
          </section>
        </>
      )}
    </main>
  );
}
