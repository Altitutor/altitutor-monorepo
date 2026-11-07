"use client";

import { z } from "zod";
import { getSupabaseClient } from "@/shared/lib/supabase/client";
import type { ManualMeetingInput } from "@/features/bookings/api/admin-meetings";

export type EnquirySource = { kind: "email" | "message"; id: string };

const sourceSchema = z.object({
  handle: z.string(),
  receivedAt: z.string(),
  parentId: z.string().nullable(),
  label: z.string(),
});
export type EnquirySender = z.infer<typeof sourceSchema>;

const name = z.string().trim().min(1, "Enter a first name").max(100);
const lastName = z.string().trim().max(100);
const email = z.union([z.literal(""), z.email()]).optional();
const phone = z.union([z.literal(""), z.string().regex(/^\+[1-9]\d{7,14}$/, "Use an international phone number")]).optional();
const existing = z.object({ kind: z.literal("existing"), id: z.guid() });
const newPerson = z.object({
  kind: z.literal("new"),
  id: z.guid(),
  firstName: name,
  lastName,
});
export const enquiryPeopleSchema = z.object({
  parent: z.discriminatedUnion("kind", [
    existing,
    newPerson.extend({ email, phone }),
  ]).nullable(),
  children: z.array(z.discriminatedUnion("kind", [existing, newPerson])).max(20),
  email,
  phone,
  label: z.string().trim().max(200),
});
export type EnquiryPeople = z.infer<typeof enquiryPeopleSchema>;

export async function getEnquirySender(source: EnquirySource) {
  const { data, error } = await getSupabaseClient().rpc("onboarding_enquiry_source", {
    p_kind: source.kind,
    p_id: source.id,
  });
  if (error) throw error;
  return sourceSchema.nullable().parse(data);
}

const receiptSchema = z.object({
  journeyIds: z.array(z.guid()),
  sessionIds: z.array(z.guid()),
});

export async function createOnboardingEnquiry(input: EnquiryPeople & {
  requestId: string;
  familyJourneyId?: string;
  source?: EnquirySource;
  assigneeId?: string;
  trials: Pick<ManualMeetingInput, "startAt" | "endAt" | "studentIds" | "parentIds" | "staffIds">[];
}) {
  const { data, error } = await getSupabaseClient().rpc("create_onboarding_enquiry", {
    p_request: input,
  });
  if (error) throw new Error(error.message);
  return receiptSchema.parse(data);
}
