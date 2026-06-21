import { UcatExamDialog } from "@altitutor/ui";
import type { ComponentProps } from "react";

type QuestionEngineDialogProps = ComponentProps<typeof UcatExamDialog>;

/** UCAT exam dialog with square corners, scoped to the question engine. */
export function QuestionEngineDialog(props: QuestionEngineDialogProps) {
  return <UcatExamDialog {...props} squareCorners />;
}
