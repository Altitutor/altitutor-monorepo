import "server-only";
import { resolveMailboxPolicy } from "@altitutor/email";
export function getMailboxPolicy() {
  return resolveMailboxPolicy(process.env);
}
