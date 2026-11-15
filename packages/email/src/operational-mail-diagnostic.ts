/** Evidence only: never include provider payloads or correspondence identifiers. */
export type OperationalMailDiagnostic = {
  phase: "draft_create" | "draft_persist" | "send_request" | "submission_persist";
  failure_kind: "timeout" | "aborted" | "http_error" | "invalid_json" | "type_error" | "other";
  http_status: number | null;
  elapsed_ms: number;
};
