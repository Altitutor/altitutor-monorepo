import { z } from "zod";
export const SMALL_EMAIL_ATTACHMENT_BYTES = 3_000_000;
export const MAX_EMAIL_ATTACHMENT_BYTES = 20_000_000;
// Six 320 KiB slices: Outlook-compatible and below the deployed request-body limit.
export const EMAIL_ATTACHMENT_CHUNK_BYTES = 1_966_080;
export const uploadFileSchema = z.object({
  id: z.string().min(1),
  changeKey: z.string().min(1),
  editToken: z.string().guid('Invalid uuid'),
  name: z.string().min(1).max(255),
  contentType: z.string().max(255),
  size: z
    .number()
    .int()
    .min(SMALL_EMAIL_ATTACHMENT_BYTES)
    .max(MAX_EMAIL_ATTACHMENT_BYTES),
});
