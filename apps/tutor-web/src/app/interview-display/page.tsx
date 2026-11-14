import { InterviewPromptDisplay } from "@/features/interviews/components/InterviewPromptDisplay";

export const metadata = {
  title: "Interview prompt",
  robots: { index: false, follow: false },
};

export default function InterviewDisplayRoute() {
  // Public blank receiver: content arrives only through the local presenter.
  // Do not load a station, catalog, or tutor props on this route.
  return <InterviewPromptDisplay />;
}
