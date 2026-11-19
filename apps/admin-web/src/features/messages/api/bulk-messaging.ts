import { getInviteUrlForStudent } from "@/shared/utils/invites";
import { readBulkStudentClasses } from "./student-class-data";
import type { Tables } from "@altitutor/shared";
import { getSupabaseClient } from "@/shared/lib/supabase/client";
import {
  ensureContactForParent,
  ensureContactForStaff,
  ensureContactForStudent,
} from "../utils/contactHelpers";
import { replaceVariables } from "../utils/variableReplacer";
import { replaceVariablesForParent } from "../utils/variableReplacerParent";
import {
  batchGenerateLinkTokens,
  templateContainsLinkVariables,
  generateLinkTokensForStaff,
} from "../utils/generateLinkTokens";

export type BulkPerson =
  | {
      kind: "student";
      person: Tables<"students">;
      included: boolean;
      parents: boolean;
    }
  | { kind: "parent"; person: Tables<"parents">; included: boolean }
  | { kind: "staff"; person: Tables<"staff">; included: boolean };
export type BulkRecipient = {
  key: string;
  kind: BulkPerson["kind"];
  id: string;
  name: string;
  phone: string | null;
  body: string;
};
export type BulkResult = BulkRecipient & {
  messageId?: string;
  status: string;
  error?: string;
};
export const personKey = (person: BulkPerson) =>
  `${person.kind}:${person.person.id}`;
export const personName = (person: {
  first_name: string | null;
  last_name: string | null;
}) => `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim();
const chunk = <T>(items: T[], size = 100): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size),
  );

export async function searchBulkPeople(
  kind: BulkPerson["kind"],
  search: string,
): Promise<BulkPerson[]> {
  const tokens = search
    .trim()
    .replace(/[,()%]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!tokens.length) return [];
  const db = getSupabaseClient();
  // Name-only search; no all-enrolments scan on every keystroke.
  if (kind === "student") {
    let query = db.from("students").select("*").is("deleted_at", null);
    for (const token of tokens)
      query = query.or(
        `first_name.ilike.%${token}%,last_name.ilike.%${token}%`,
      );
    const { data, error } = await query.order("first_name").limit(30);
    if (error) throw error;
    return (data ?? []).map((person) => ({
      kind,
      person,
      included: true,
      parents: false,
    }));
  }
  if (kind === "parent") {
    let query = db.from("parents").select("*").is("deleted_at", null);
    for (const token of tokens)
      query = query.or(
        `first_name.ilike.%${token}%,last_name.ilike.%${token}%`,
      );
    const { data, error } = await query.order("first_name").limit(30);
    if (error) throw error;
    return (data ?? []).map((person) => ({ kind, person, included: true }));
  }
  let query = db
    .from("staff")
    .select("*")
    .is("deleted_at", null)
    .eq("status", "ACTIVE");
  for (const token of tokens)
    query = query.or(`first_name.ilike.%${token}%,last_name.ilike.%${token}%`);
  const { data, error } = await query.order("first_name").limit(30);
  if (error) throw error;
  return (data ?? []).map((person) => ({ kind, person, included: true }));
}

export async function prepareBulkRecipients(
  selected: BulkPerson[],
  template: string,
  senderName: string,
  generateLinks = false,
): Promise<BulkRecipient[]> {
  const db = getSupabaseClient();
  const renderTemplate = !generateLinks
    ? template.replace(
        /\{(?:parent\.student\d+\.)?(registration_link|invite_link|forgot_password_link)\}/gi,
        (_match, kind: string) => `[${kind.replaceAll("_", " ")}]`,
      )
    : template;
  const students = selected.flatMap((row) =>
    row.kind === "student" && (row.included || row.parents) ? [row] : [],
  );
  const parents = new Map<
    string,
    { person: Tables<"parents">; students: Tables<"students">[] }
  >();
  for (const row of selected)
    if (row.kind === "parent" && row.included)
      parents.set(row.person.id, { person: row.person, students: [] });
  for (const batch of chunk(
    students.filter((row) => row.parents).map((row) => row.person.id),
  )) {
    const { data, error } = await db
      .from("parents_students")
      .select("student_id, parent:parents(*)")
      .in("student_id", batch);
    if (error) throw error;
    for (const row of data ?? []) {
      if (!row.parent || row.parent.deleted_at) continue;
      const student = students.find(
        (student) => student.person.id === row.student_id,
      )?.person;
      const entry = parents.get(row.parent.id) ?? {
        person: row.parent,
        students: [],
      };
      if (student && !entry.students.some((item) => item.id === student.id))
        entry.students.push(student);
      parents.set(row.parent.id, entry);
    }
  }

  // Direct parent selection has the same child-template context as selection
  // through a student. Load it only when the template references children.
  if (/\{parent\.student\d+\./i.test(template)) {
    const directIds = selected.flatMap((row) =>
      row.kind === "parent" && row.included ? [row.person.id] : [],
    );
    for (const batch of chunk(directIds))
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await db
          .from("parents_students")
          .select("parent_id, student:students(*)")
          .in("parent_id", batch)
          .order("id")
          .range(offset, offset + 999);
        if (error) throw error;
        for (const row of data ?? []) {
          const parent = parents.get(row.parent_id);
          if (
            parent &&
            row.student &&
            !row.student.deleted_at &&
            !parent.students.some((child) => child.id === row.student.id)
          )
            parent.students.push(row.student);
        }
        if (!data || data.length < 1000) break;
      }
  }
  for (const parent of parents.values())
    parent.students.sort((a, b) => personName(a).localeCompare(personName(b)));
  const studentRecords = new Map(
    students.map((row) => [row.person.id, row.person]),
  );
  for (const parent of parents.values())
    for (const child of parent.students) studentRecords.set(child.id, child);
  const ids = [...studentRecords.keys()];
  const classes =
    /\{(?:classes|classes_with_start_date|parent\.student\d+\.classes(?:_with_start_date)?)\}/i.test(
      template,
    )
      ? await readBulkStudentClasses(
          ids,
          /classes_with_start_date/i.test(template),
        )
      : {};
  const tokens: Awaited<ReturnType<typeof batchGenerateLinkTokens>> = {};
  const linkRequests = new Map<
    string,
    {
      includeRegistration: boolean;
      includeInvite: boolean;
      includePasswordReset: boolean;
    }
  >();
  for (const match of template.matchAll(
    /\{(?:(parent\.student(\d+))\.)?(registration_link|invite_link|forgot_password_link)\}/gi,
  )) {
    const targets = match[1]
      ? [...parents.values()].flatMap((parent) => {
          const child = parent.students[Number(match[2]) - 1];
          if (!child)
            throw new Error(
              `Cannot render student ${match[2]} for ${personName(parent.person)}. Review the recipient/template.`,
            );
          return [child.id];
        })
      : students.filter((row) => row.included).map((row) => row.person.id);
    for (const id of targets) {
      const flags = linkRequests.get(id) ?? {
        includeRegistration: false,
        includeInvite: false,
        includePasswordReset: false,
      };
      if (match[3].toLowerCase() === "registration_link")
        flags.includeRegistration = true;
      if (match[3].toLowerCase() === "invite_link") flags.includeInvite = true;
      if (match[3].toLowerCase() === "forgot_password_link")
        flags.includePasswordReset = true;
      linkRequests.set(id, flags);
    }
  }
  if (generateLinks) {
    // Group equal requirements so unrelated children do not receive link-generation side effects.
    const groups = new Map<
      string,
      {
        ids: string[];
        flags: {
          includeRegistration: boolean;
          includeInvite: boolean;
          includePasswordReset: boolean;
        };
      }
    >();
    for (const [id, flags] of linkRequests) {
      const key = JSON.stringify(flags);
      const group = groups.get(key) ?? { ids: [], flags };
      group.ids.push(id);
      groups.set(key, group);
    }
    for (const { ids, flags } of groups.values())
      for (const batch of chunk(ids))
        Object.assign(tokens, await batchGenerateLinkTokens(batch, flags));
    for (const [id, flags] of linkRequests) {
      if (
        (flags.includeRegistration && !tokens[id]?.registrationToken) ||
        (flags.includeInvite && !tokens[id]?.inviteToken) ||
        (flags.includePasswordReset && !tokens[id]?.forgotPasswordLink)
      ) {
        throw new Error(
          `Unable to generate required links for ${personName(studentRecords.get(id)!)}. No messages queued.`,
        );
      }
    }
  }
  const results: BulkRecipient[] = [];
  for (const row of selected) {
    if (!row.included || row.kind === "parent") continue;
    const person = row.person;
    let body: string;
    if (row.kind === "student")
      body = await replaceVariables(
        renderTemplate,
        row.person,
        classes[person.id] ?? [],
        senderName,
        {
          ...tokens[person.id],
          classesWithStartDates: classes[person.id] ?? [],
        },
      );
    else {
      const staffTokens =
        generateLinks && templateContainsLinkVariables(template)
          ? await generateLinkTokensForStaff(
              row.person.id,
              row.person.role ?? "",
              {
                includeInvite: /\{invite_link\}/i.test(template),
                includePasswordReset: /\{forgot_password_link\}/i.test(
                  template,
                ),
              },
            )
          : {};
      body = renderTemplate
        .replace(/\{first_name\}/gi, person.first_name ?? "")
        .replace(/\{full_name\}/gi, personName(person))
        .replace(/\{sender_name\}/gi, senderName)
        .replace(/\{last_name\}/gi, person.last_name ?? "");
      if (staffTokens.inviteToken)
        body = body.replace(
          /\{invite_link\}/gi,
          getInviteUrlForStudent(staffTokens.inviteToken, "invite"),
        );
      if (staffTokens.forgotPasswordLink)
        body = body.replace(
          /\{forgot_password_link\}/gi,
          staffTokens.forgotPasswordLink,
        );
    }
    results.push({
      key: personKey(row),
      kind: row.kind,
      id: person.id,
      name: personName(person),
      phone: row.kind === "staff" ? row.person.phone_number : row.person.phone,
      body,
    });
  }
  for (const { person, students: children } of parents.values()) {
    children.sort((a, b) => personName(a).localeCompare(personName(b)));
    const body = await replaceVariablesForParent(
      renderTemplate,
      person,
      children.map((student) => ({
        student,
        classes: classes[student.id] ?? [],
        classesWithStartDates: classes[student.id] ?? [],
        linkTokens: tokens[student.id],
      })),
      senderName,
    );
    results.push({
      key: `parent:${person.id}`,
      kind: "parent",
      id: person.id,
      name: personName(person),
      phone: person.phone,
      body: body
        .replace(/\{first_name\}/gi, person.first_name ?? "")
        .replace(/\{full_name\}/gi, personName(person)),
    });
  }
  return results;
}

/** Once a message has an ID, it is queued even if dispatch acknowledgement is
 * lost. Never retry that insert or call it failed based on elapsed time. */
export async function queueBulkMessages(
  recipients: BulkRecipient[],
  senderId: string,
  staffId: string,
  onResult: (result: BulkResult) => void,
) {
  const db = getSupabaseClient();
  const { data: sender, error } = await db
    .from("owned_numbers")
    .select("*")
    .eq("id", senderId)
    .single();
  if (error) throw error;
  const from =
    sender.sender_type === "ALPHANUMERIC"
      ? sender.alphanumeric_sender_id
      : sender.phone_e164;
  if (!from) throw new Error("The selected sender has no sending address.");
  const contacts = new Map<
    string,
    { id: string; is_opted_out: boolean | null }
  >();
  // Three batched reads replace one contact lookup per person.
  for (const kind of ["student", "parent", "staff"] as const)
    for (const batch of chunk(
      recipients.filter((row) => row.kind === kind).map((row) => row.id),
    )) {
      const column =
        kind === "student"
          ? "student_id"
          : kind === "parent"
            ? "parent_id"
            : "staff_id";
      const { data, error } = await db
        .from("contacts")
        .select("id, student_id, parent_id, staff_id, is_opted_out")
        .in(column, batch)
        .is("retired_at", null);
      if (error) throw error;
      for (const row of data ?? []) contacts.set(`${kind}:${row[column]}`, row);
    }
  const conversations = new Map<string, string>();
  for (const batch of chunk([...contacts.values()].map((row) => row.id))) {
    const { data, error } = await db
      .from("conversations")
      .select("id,contact_id")
      .in("contact_id", batch)
      .eq("owned_number_id", senderId)
      .in("status", ["OPEN", "SNOOZED"]);
    if (error) throw error;
    for (const row of data ?? [])
      if (row.contact_id) conversations.set(row.contact_id, row.id);
  }
  // Bounded sequential queueing leaves capacity for other users and avoids
  // unbounded function invocation promises during a large broadcast.
  for (const recipient of recipients) {
    let messageId: string | undefined;
    try {
      if (!recipient.phone) {
        onResult({ ...recipient, status: "SKIPPED", error: "No phone number" });
        continue;
      }
      if (/\{[\w.]+\}/.test(recipient.body))
        throw new Error(
          "Unresolved template variables. Edit the template before sending.",
        );
      let contact = contacts.get(recipient.key);
      if (!contact) {
        const id = await (recipient.kind === "student"
          ? ensureContactForStudent(recipient.id)
          : recipient.kind === "parent"
            ? ensureContactForParent(recipient.id)
            : ensureContactForStaff(recipient.id));
        if (!id) throw new Error("Unable to resolve message contact.");
        const { data, error } = await db
          .from("contacts")
          .select("id,is_opted_out")
          .eq("id", id)
          .single();
        if (error) throw error;
        contact = data;
      }
      if (contact.is_opted_out) {
        onResult({
          ...recipient,
          status: "SKIPPED",
          error: "Contact opted out",
        });
        continue;
      }
      let conversationId = conversations.get(contact.id);
      if (!conversationId) {
        const { data, error } = await db
          .from("conversations")
          .insert({
            contact_id: contact.id,
            owned_number_id: senderId,
            status: "OPEN",
          })
          .select("id")
          .single();
        if (error?.code === "23505") {
          const retry = await db
            .from("conversations")
            .select("id")
            .eq("contact_id", contact.id)
            .eq("owned_number_id", senderId)
            .in("status", ["OPEN", "SNOOZED"])
            .limit(1)
            .single();
          if (retry.error) throw retry.error;
          conversationId = retry.data.id;
        } else {
          if (error) throw error;
          conversationId = data.id;
        }
        conversations.set(contact.id, conversationId);
      }
      const candidateId = crypto.randomUUID();
      messageId = candidateId;
      const { data, error: insertError } = await db
        .from("messages")
        .insert({
          id: candidateId,
          conversation_id: conversationId,
          direction: "OUTBOUND",
          body: recipient.body,
          status: "QUEUED",
          created_by_staff_id: staffId,
          from_number_e164: sender.sender_type === "PHONE" ? from : null,
          to_number_e164: recipient.phone,
          is_announcement: true,
        })
        .select("id")
        .single();
      if (insertError) {
        if (/^(?:[0-9A-Z]{5}|PGRST\d+)$/.test(insertError.code))
          messageId = undefined;
        else {
          onResult({
            ...recipient,
            messageId: candidateId,
            status: "UNCONFIRMED",
            error:
              "Queue acknowledgement was lost. Check this message ID before retrying.",
          });
          continue;
        }
        throw insertError;
      }
      messageId = data.id;
      onResult({ ...recipient, messageId, status: "QUEUED" });
      // iMessage commands are created transactionally by the existing trigger.
      // Twilio needs explicit dispatch. Transport failure leaves a queued row.
      if (sender.provider !== "IMESSAGE") {
        const { error: dispatchError } = await db.functions.invoke(
          "send-message",
          { body: { messageId } },
        );
        if (dispatchError)
          onResult({
            ...recipient,
            messageId,
            status: "QUEUED",
            error:
              "Dispatch could not be confirmed. Check delivery status before retrying.",
          });
      }
    } catch (cause) {
      onResult({
        ...recipient,
        messageId,
        status: messageId ? "QUEUED" : "FAILED",
        error:
          cause instanceof Error
            ? cause.message
            : typeof cause === "object" && cause && "message" in cause
              ? String(cause.message)
              : "Unable to queue message",
      });
    }
  }
}
