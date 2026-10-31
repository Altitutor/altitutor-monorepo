import { z } from "zod";
export const emailMessageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  folderId: z.string().nullable().optional(),
  subject: z
    .string()
    .nullish()
    .transform((value) => value ?? ""),
  bodyText: z
    .string()
    .nullish()
    .transform((value) => value ?? ""),
  bodyHtml: z.string().nullish(),
  sender: z
    .string()
    .nullish()
    .transform((value) => value ?? ""),
  senderName: z.string().nullish(),
  to: z.array(z.string()).default([]),
  cc: z.array(z.string()).default([]),
  bcc: z.array(z.string()).default([]),
  removed: z.boolean().default(false),
  read: z.boolean().optional(),
  draft: z.boolean().optional(),
  hasAttachments: z.boolean().optional(),
  receivedAt: z.string().nullish(),
  sentAt: z.string().nullish(),
  changeKey: z.string().nullish(),
});
export type EmailMessage = z.infer<typeof emailMessageSchema>;
export const emailThreadSchema = z.object({
  id: z.string(),
  assignedStaffId: z.string().nullable(),
  assignedAt: z.string().nullable(),
  links: z.array(
    z.object({
      recordType: z.enum([
        "student",
        "parent",
        "staff",
        "session",
        "invoice",
        "onboarding_journey",
      ]),
      recordId: z.string(),
      source: z.enum(["direct", "explicit"]),
      label: z.string().optional(),
    }),
  ),
  messages: z.array(emailMessageSchema),
});
export type EmailThread = z.infer<typeof emailThreadSchema>;
export const emailFolderSchema = z.object({
  id: z.string(),
  name: z.string(),
  parent_id: z.string().nullable(),
  role: z.string().nullable().optional(),
});
export type EmailFolder = z.infer<typeof emailFolderSchema>;
export const draftContentSchema = z.object({
  expectedChangeKey: z.string().min(1),
  bodyText: z.string().max(1_000_000),
  bodyHtml: z.string().max(1_000_000).optional(),
  subject: z.string().max(998),
  to: z.array(z.string().email()).max(100),
  cc: z.array(z.string().email()).max(100).default([]),
  bcc: z.array(z.string().email()).max(100).default([]),
});
export const emailCommandSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("read"),
    ids: z.array(z.string().min(1)).min(1).max(100),
    read: z.boolean(),
  }),
  z.object({
    action: z.literal("move"),
    ids: z.array(z.string().min(1)).min(1).max(100),
    folderId: z.string().min(1),
  }),
  z.object({
    action: z.literal("assign"),
    threadId: z.string().min(1),
    staffId: z.string().uuid().nullable(),
  }),
  z.object({
    action: z.literal("link"),
    threadId: z.string().min(1),
    recordType: z.enum([
      "student",
      "parent",
      "staff",
      "session",
      "invoice",
      "onboarding_journey",
    ]),
    recordId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("draft"),
    messageId: z.string().optional(),
    mode: z.enum(["new", "reply", "replyAll", "forward"]),
    to: z.array(z.string().email()).optional(),
  }),
  z.object({
    action: z.literal("save"),
    editToken: z.string().uuid(),
    id: z.string().min(1),
    content: draftContentSchema,
  }),
  z.object({
    action: z.literal("releaseDraft"),
    id: z.string().min(1),
    editToken: z.string().uuid(),
  }),
  z.object({
    action: z.literal("discard"),
    editToken: z.string().uuid(),
    id: z.string().min(1),
    changeKey: z.string().min(1),
  }),
  z.object({
    action: z.literal("schedule"),
    id: z.string().min(1),
    changeKey: z.string().min(1),
    commandId: z.string().uuid(),
    scheduledAt: z.string().datetime({ offset: true }),
  }),
  z.object({ action: z.literal("cancelSchedule"), id: z.string().uuid() }),
  z.object({
    action: z.literal("send"),
    id: z.string().min(1),
    changeKey: z.string().min(1),
    commandId: z.string().uuid(),
  }),
]);
export type EmailCommand = z.infer<typeof emailCommandSchema>;
export const emailSummarySchema = z.object({
  id: z.string(),
  messageIds: z.array(z.string()),
  subject: z.string(),
  preview: z.string(),
  sender: z.string(),
  senderName: z.string().nullable(),
  at: z.string().nullable(),
  read: z.boolean(),
  draft: z.boolean(),
  assignedStaffId: z.string().nullable(),
});
export const emailListSchema = z.object({
  threads: z.array(emailSummarySchema),
  hasMore: z.boolean(),
});
export const mailboxSchema = emailListSchema.extend({
  mailboxAddress: z.string().email(),
  mailboxEnvironment: z.enum(["development", "production"]),
  folders: z.array(emailFolderSchema),
  staff: z.array(
    z.object({
      id: z.string(),
      first_name: z.string().nullable(),
      last_name: z.string().nullable(),
    }),
  ),
  currentStaffId: z.string(),
  configured: z.boolean(),
  signature: z.string(),
  templates: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      subject: z.string(),
      body_text: z.string(),
    }),
  ),
  sync: z.array(
    z.object({
      folder_id: z.string(),
      page_at: z.string().nullable(),
      completed_at: z.string().nullable(),
      last_error: z.string().nullable(),
    }),
  ),
});
export type MailboxData = z.infer<typeof mailboxSchema>;
export type EmailSummary = z.infer<typeof emailSummarySchema>;
export const draftResponseSchema = z.object({
  state: z.string(),
  message: emailMessageSchema.optional(),
  signature: z.string().optional(),
});
