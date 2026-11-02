import type { InterviewPhase } from "./index";

/** No provider payloads or encounter identifiers may cross this boundary. */
export interface InterviewCallFailure {
  source: "sdk" | "join" | "recovery";
  category: "connection" | "configuration" | "unknown";
  phase: InterviewPhase;
  state: "joining" | "joined";
}
