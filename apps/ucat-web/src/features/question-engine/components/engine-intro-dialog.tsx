import { HelpCircle } from "lucide-react";
import { UcatExamActionButton, UcatExamDialog } from "@altitutor/ui";

export function EngineIntroDialog({
  title,
  description,
  onStart,
  onCancel,
}: {
  title: string;
  description: string;
  onStart: () => void;
  onCancel: () => void;
}) {
  return (
    <UcatExamDialog
      title={title}
      icon={<HelpCircle className="h-12 w-12" />}
      message={<p>{description}</p>}
      actions={
        <>
          <UcatExamActionButton borders="all" onClick={onStart}>
            <span>
              <span className="underline">Y</span>es
            </span>
          </UcatExamActionButton>
          <UcatExamActionButton borders="all" onClick={onCancel}>
            <span>
              <span className="underline">N</span>o
            </span>
          </UcatExamActionButton>
        </>
      }
      className="max-w-6xl"
    />
  );
}
