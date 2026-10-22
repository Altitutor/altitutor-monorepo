import { notFound } from "next/navigation";
import { InterviewAuthoringPrototype } from "@/features/interviews/prototype/InterviewAuthoringPrototype";

export default function InterviewAuthoringPrototypePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <InterviewAuthoringPrototype />;
}
