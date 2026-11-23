import { OFFICE_ADDRESS } from "@altitutor/email/company-address";
import archivedAddresses from "@/features/marketing/content/archived-addresses.json";

// Match the longest archived address first and replace each occurrence once.
const archivedAddress = new RegExp(archivedAddresses.join("|"), "g");

export function withOfficeAddress(copy: string) {
  return copy.replace(archivedAddress, OFFICE_ADDRESS);
}
