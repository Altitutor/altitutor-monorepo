import { z } from 'zod';

export const automationRecoverySchema = z.object({
  messageId: z.string(), body: z.string(), originalDestination: z.string(),
  originalCreatedAt: z.string(), senderId: z.string(), senderLabel: z.string(),
  contactId: z.string().nullable(), destination: z.string().nullable(), recipientName: z.string(),
  recoveryMessageId: z.string().nullable(), recoveryStatus: z.string().nullable(),
  canSend: z.boolean(), reason: z.string().nullable(), recipientPath: z.string().nullable(),
});
export type AutomationRecoveryPreview = z.infer<typeof automationRecoverySchema>;
