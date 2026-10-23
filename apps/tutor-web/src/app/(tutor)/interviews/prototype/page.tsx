import { notFound } from "next/navigation";
import { InterviewPrototype } from "@/features/interviews/prototype/InterviewPrototype";

// Throwaway DEV-8 route. Never expose the prototype in a production build.
export default function InterviewPrototypePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <InterviewPrototype />;
}
