import type { EmailFolder, EmailMessage } from "../types";
/** Deleted Items retain Graph's isDraft flag; they are no longer live editors. */
export function isEditableDraft(message: EmailMessage, folders: EmailFolder[]) {
  return Boolean(
    message.draft &&
      !message.removed &&
      message.folderId !== "deleteditems" &&
      !folders.some(
        (folder) =>
          folder.id === message.folderId && folder.role === "deleteditems",
      ),
  );
}
