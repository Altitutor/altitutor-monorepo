import { HelpCircle } from "lucide-react";
import { UcatExamActionButton } from "@altitutor/ui";
import { QuestionEngineDialog } from "@/features/question-engine/components/question-engine-dialog";

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
    <QuestionEngineDialog
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
