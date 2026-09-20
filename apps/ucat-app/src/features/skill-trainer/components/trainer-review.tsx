import { Copy, Group } from "@/components/ui";
import { RichContent } from "@/components/rich-content";
export type TrainerReviewItem = {
  id: string;
  content: Record<string, unknown>;
  answer: unknown;
  correct: boolean;
  score_delta: number;
  elapsed_seconds: number | null;
};
export type TrainerReviewData = { items: TrainerReviewItem[] };
function value(v: unknown): string {
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map(value).join(" ");
  return "Not recorded";
}
export function TrainerReview({
  items,
  trainerKey,
}: {
  items: TrainerReviewItem[];
  trainerKey: string;
}) {
  return (
    <>
      {!items.length && (
        <Group title="Question review">
          <Copy muted>No questions were completed in this session.</Copy>
        </Group>
      )}
      {items.map((item, i) => {
        const c = item.content;
        const word = trainerKey === "find_word";
        const concept = trainerKey === "find_concept";
        const keywords = Array.isArray(c.keywords)
          ? c.keywords
              .filter((v): v is { text: string } =>
                Boolean(v && typeof v === "object" && "text" in v),
              )
              .map((v) => v.text)
          : [];
        return (
          <Group
            key={item.id}
            title={`Question ${i + 1} · ${item.correct ? "Correct" : "Incorrect"}`}
          >
            {Array.isArray(c.premises) &&
              c.premises.map((p, i) => <Copy key={i}>{String(p)}</Copy>)}
            {c.conclusion || c.statement ? (
              <Copy>{String(c.conclusion ?? c.statement)}</Copy>
            ) : null}
            {concept && (
              <Copy>Find every occurrence of “{String(c.concept ?? "")}”.</Copy>
            )}
            <RichContent
              json={word || concept ? c.passage : c.question}
              text={typeof c.expression === "string" ? c.expression : undefined}
            />
            {trainerKey === "numpad_speed" && (
              <Copy>
                {typeof c.label === "string"
                  ? c.label
                  : "Reproduce the target key sequence"}
              </Copy>
            )}
            <Copy>
              Your answer:{" "}
              {word && item.correct
                ? "All keywords placed"
                : concept
                  ? item.correct
                    ? "All occurrences found"
                    : "Skipped before finding all occurrences"
                  : value(item.answer)}
            </Copy>
            <Copy>
              Correct answer:{" "}
              {word
                ? keywords.join(", ")
                : concept
                  ? `${Array.isArray(c.occurrences) ? c.occurrences.length : 0} occurrences`
                  : value(c.button_sequence ?? c.answer)}
            </Copy>
            <Copy muted>
              {item.score_delta} points
              {item.elapsed_seconds !== null
                ? ` · ${item.elapsed_seconds}s`
                : ""}
            </Copy>
          </Group>
        );
      })}
    </>
  );
}
