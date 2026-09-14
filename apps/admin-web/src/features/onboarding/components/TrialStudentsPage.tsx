"use client";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Input,
  SearchableSelect,
  SegmentedControl,
} from "@altitutor/ui";
import { Plus, Settings2 } from "lucide-react";
import { AdminDialogShell } from "@/shared/components/dialog-shell";
import { useStudentSearchFilter } from "@/features/students/hooks/useStudentSearchFilter";
import { getSupabaseClient } from "@/shared/lib/supabase/client";
import {
  useOnboardingJourneys,
  useOnboardingSettings,
  onboardingKey,
} from "../api/queries";
import {
  defaultDeadlines,
  isOpen,
  lifecycle,
  nextActions,
  stages,
  type Journey,
} from "../lib/model";
import { ConversionInsights } from "./ConversionInsights";
import { MailboxReview } from "./MailboxReview";
import type { Tables } from "@altitutor/shared";
import { ActionBadges, JourneyDetail } from "./JourneyDetail";

function NewJourney({
  onClose,
  sourceEmail,
}: {
  onClose: () => void;
  sourceEmail?: Tables<"onboarding_emails">;
}) {
  const [search, setSearch] = useState("");
  const [studentId, setStudentId] = useState<string>();
  const [label, setLabel] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(sourceEmail?.sender ?? "");
  const [historical, setHistorical] = useState(false);
  const [returning, setReturning] = useState(false);
  const [enquiry, setEnquiry] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: searchData } = useStudentSearchFilter(search, [
    "ACTIVE",
    "TRIAL",
    "DISCONTINUED",
  ]);
  const qc = useQueryClient();
  async function create() {
    setBusy(true);
    setError("");
    try {
      if (!studentId && !phone && !email)
        throw new Error("Link a student, phone number, or email address.");
      const db = getSupabaseClient();
      let contactId: string | null = null;
      if (!studentId && phone) {
        if (!/^\+[1-9]\d{7,14}$/.test(phone))
          throw new Error(
            "Enter the enquiry phone number in international format, e.g. +61412345678.",
          );
        const existing = await db
          .from("contacts")
          .select("id")
          .eq("phone_e164", phone)
          .maybeSingle();
        if (existing.error) throw existing.error;
        contactId = existing.data?.id ?? null;
        if (!contactId) {
          const created = await db
            .from("contacts")
            .insert({ phone_e164: phone, contact_type: "LEAD" })
            .select("id")
            .single();
          if (created.error) throw created.error;
          contactId = created.data.id;
        }
      }
      const { data: created, error } = await db
        .from("onboarding_journeys")
        .insert({
          student_id: studentId ?? null,
          contact_id: contactId,
          label,
          enquiry_email: email || null,
          enquiry_at: historical
            ? null
            : new Date(`${enquiry}T12:00:00`).toISOString(),
          historical,
          is_returning: returning,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (sourceEmail) {
        const linked = await db
          .from("onboarding_email_links")
          .insert({ email_id: sourceEmail.id, journey_id: created.id });
        if (linked.error) setError(linked.error.message);
      }
      await qc.invalidateQueries({ queryKey: onboardingKey });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create journey.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AdminDialogShell
      open
      onClose={onClose}
      title="New enquiry"
      footer={
        <Button
          disabled={busy || !label.trim() || (!historical && !enquiry)}
          onClick={() => void create()}
        >
          Create journey
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Use an existing student when possible. Returning students keep their
          original identity and trial evidence.
        </p>
        <SearchableSelect
          items={searchData?.students ?? []}
          getItemId={(s) => s.id}
          getItemLabel={(s) => `${s.first_name} ${s.last_name}`}
          onSearchChange={setSearch}
          value={searchData?.students.find((s) => s.id === studentId) ?? null}
          onValueChange={(s) => {
            setStudentId(s?.id);
            if (s) setLabel(`${s.first_name} ${s.last_name}`);
          }}
          placeholder="Find existing student"
        />
        <label className="block text-sm">
          Student or family name
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        {!studentId && (
          <label className="block text-sm">
            Enquiry phone number
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+61412345678"
            />
          </label>
        )}{" "}
        {!studentId && (
          <label className="block text-sm">
            Enquiry email
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        )}
        <label className="block text-sm">
          First identifiable enquiry
          <Input
            type="date"
            value={enquiry}
            disabled={historical}
            onChange={(e) => setEnquiry(e.target.value)}
          />
        </label>
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={historical}
            onChange={(e) => setHistorical(e.target.checked)}
          />
          Historical · original enquiry date unknown
        </label>
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={returning}
            onChange={(e) => setReturning(e.target.checked)}
          />
          Returning student · new journey
        </label>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </div>
    </AdminDialogShell>
  );
}
function Settings({ onClose }: { onClose: () => void }) {
  const { data } = useOnboardingSettings();
  const qc = useQueryClient();
  const [cadence, setCadence] = useState(
    data?.followup_business_days.join(", ") ?? "2, 5, 10",
  );
  const [days, setDays] = useState<Record<string, number>>({
    ...defaultDeadlines,
    ...((data?.action_business_days as Record<string, number>) ?? {}),
  });
  const [error, setError] = useState("");
  async function save() {
    const values = cadence.split(",").map(Number);
    if (
      values.some(
        (v, i) =>
          !Number.isInteger(v) || v < 1 || (i > 0 && v <= values[i - 1]),
      )
    ) {
      setError("Follow-up days must be positive and increasing.");
      return;
    }
    const { error } = await getSupabaseClient()
      .from("onboarding_settings")
      .update({ followup_business_days: values, action_business_days: days })
      .eq("id", true);
    if (error) {
      setError(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: onboardingKey });
    onClose();
  }
  return (
    <AdminDialogShell
      open
      onClose={onClose}
      title="Queue settings"
      footer={<Button onClick={() => void save()}>Save settings</Button>}
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Business days. These settings create queue deadlines; they do not send
          automated texts.
        </p>
        <label className="block text-sm">
          Family follow-up cadence
          <Input value={cadence} onChange={(e) => setCadence(e.target.value)} />
        </label>
        {Object.keys(defaultDeadlines).map((key) => (
          <label key={key} className="block text-sm">
            {key.replaceAll("_", " ")}
            <Input
              type="number"
              min={0}
              value={days[key]}
              onChange={(e) =>
                setDays((s) => ({
                  ...s,
                  [key]: Math.max(0, Number(e.target.value)),
                }))
              }
            />
          </label>
        ))}
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
      </div>
    </AdminDialogShell>
  );
}
export function TrialStudentsPage() {
  const { data: journeys = [], isLoading, error } = useOnboardingJourneys();
  const { data: settings } = useOnboardingSettings();
  const [view, setView] = useState<"board" | "worklist">("board");
  const [section, setSection] = useState<"queue" | "insights">("queue");
  const [filter, setFilter] = useState("open");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string>();
  const [create, setCreate] = useState(false);
  const [mailbox, setMailbox] = useState(false);
  const [sourceEmail, setSourceEmail] = useState<Tables<"onboarding_emails">>();
  const [configure, setConfigure] = useState(false);
  const deadlines = useMemo(
    () => ({
      ...defaultDeadlines,
      ...((settings?.action_business_days as Record<string, number>) ?? {}),
    }),
    [settings],
  );
  const actions = (j: Journey) =>
    nextActions(j, deadlines, new Date(), settings?.followup_business_days);
  const matches = (j: Journey, key: string) =>
    key === "closed"
      ? !isOpen(j)
      : isOpen(j) &&
        (key === "open" ||
          actions(j).some((a) =>
            key === "ours"
              ? !a.waiting
              : key === "waiting"
                ? a.waiting
                : a.overdue,
          ));
  const searched = journeys.filter((j) =>
    `${j.label} ${j.evidence.subjects.map((s) => s.name).join(" ")}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const rows = searched.filter((j) => matches(j, filter));
  const current = journeys.find((j) => j.id === selected);
  return (
    <div className="p-6 space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Trial students</h1>
          <p className="text-sm text-muted-foreground">
            Enquiries, onboarding and first check-ins
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setConfigure(true)}>
            <Settings2 size={16} className="mr-2" />
            Settings
          </Button>
          <Button variant="outline" onClick={() => setMailbox(true)}>
            Review mailbox
          </Button>
          <Button
            onClick={() => {
              setSourceEmail(undefined);
              setCreate(true);
            }}
          >
            <Plus size={16} className="mr-2" />
            New enquiry
          </Button>
        </div>
      </header>
      <div className="flex flex-wrap justify-between gap-2">
        <SegmentedControl
          value={section}
          onValueChange={setSection}
          options={[
            { value: "queue", label: "Work queue" },
            { value: "insights", label: "Conversion insights" },
          ]}
        />
        {section === "queue" && (
          <SegmentedControl
            aria-label="Queue view"
            value={view}
            onValueChange={setView}
            options={[
              { value: "board", label: "Board" },
              { value: "worklist", label: "Worklist" },
            ]}
          />
        )}
      </div>
      {error && (
        <p
          role="alert"
          className="border border-destructive rounded p-4 text-destructive"
        >
          Could not load onboarding: {error.message}
        </p>
      )}
      {isLoading && <p role="status">Loading journeys…</p>}
      {section === "queue" ? (
        <>
          <div className="flex flex-wrap gap-3 justify-between">
            <SegmentedControl
              size="sm"
              aria-label="Queue filter"
              value={filter}
              onValueChange={setFilter}
              options={[
                ["open", "All open"],
                ["ours", "Our action"],
                ["waiting", "Waiting"],
                ["overdue", "Overdue"],
                ["closed", "Completed / closed"],
              ].map(([value, label]) => ({
                value,
                label,
                badge: searched.filter((j) => matches(j, value)).length,
              }))}
            />
            <Input
              aria-label="Search journeys"
              className="w-64"
              placeholder="Search student or subject"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {view === "board" ? (
            <div className="flex gap-3 overflow-x-auto pb-4">
              {stages.map((stage, index) => (
                <section
                  key={stage}
                  className="w-64 min-w-64 rounded-lg border bg-muted/30 p-3"
                >
                  <h2 className="font-medium text-sm mb-3 flex justify-between">
                    {stage}
                    <Badge variant="outline">
                      {rows.filter((j) => lifecycle(j) === index).length}
                    </Badge>
                  </h2>
                  <div className="space-y-2">
                    {rows
                      .filter((j) => lifecycle(j) === index)
                      .map((j) => (
                        <button
                          key={j.id}
                          onClick={() => setSelected(j.id)}
                          className="w-full text-left border rounded-lg p-3 bg-card space-y-2 hover:border-primary focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <strong className="block">{j.label}</strong>
                          <span className="block text-xs text-muted-foreground">
                            {j.evidence.subjects.map((s) => s.name).join(" · ")}
                          </span>
                          <ActionBadges actions={actions(j)} />
                          <span className="block text-sm">
                            {actions(j)[0]?.label ??
                              j.closure_reason ??
                              "Completed"}
                          </span>
                        </button>
                      ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-3">Student / family</th>
                    <th className="p-3">Stage</th>
                    <th className="p-3">Next action</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows
                    .sort(
                      (a, b) =>
                        Number(actions(b).some((a) => a.overdue)) -
                        Number(actions(a).some((a) => a.overdue)),
                    )
                    .map((j) => (
                      <tr
                        key={j.id}
                        className="border-b cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelected(j.id)}
                      >
                        <td className="p-3">
                          <button
                            className="text-left font-medium"
                            onClick={() => setSelected(j.id)}
                          >
                            {j.label}
                          </button>
                        </td>
                        <td className="p-3">{stages[lifecycle(j)]}</td>
                        <td className="p-3">
                          {actions(j)[0]?.label ??
                            j.closure_reason ??
                            "Completed"}
                        </td>
                        <td className="p-3">
                          <ActionBadges actions={actions(j)} />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
          {!rows.length && !isLoading && !error && (
            <p className="text-muted-foreground py-6">
              No journeys match this view. Create an enquiry to start tracking a
              student.
            </p>
          )}
        </>
      ) : (
        <ConversionInsights
          journeys={journeys}
          deadlines={deadlines}
          cadence={settings?.followup_business_days ?? [2, 5, 10]}
        />
      )}
      {current && (
        <JourneyDetail
          key={current.id}
          journey={current}
          deadlines={deadlines}
          onClose={() => setSelected(undefined)}
        />
      )}{" "}
      {create && (
        <NewJourney
          sourceEmail={sourceEmail}
          onClose={() => setCreate(false)}
        />
      )}{" "}
      {mailbox && (
        <MailboxReview
          journeys={journeys}
          onClose={() => setMailbox(false)}
          onEnquiry={(email) => {
            setSourceEmail(email);
            setMailbox(false);
            setCreate(true);
          }}
        />
      )}
      {configure && <Settings onClose={() => setConfigure(false)} />}
    </div>
  );
}
