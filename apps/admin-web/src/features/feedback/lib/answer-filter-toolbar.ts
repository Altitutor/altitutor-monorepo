import type { ToolbarConditionFilters } from "@altitutor/ui";
import type { AnswerFilter, AnswerFilterQuestion } from "./answer-filters";

export function buildAnswerFilterToolbar(
  questions: AnswerFilterQuestion[],
  filters: AnswerFilter[],
  onChange: (filters: AnswerFilter[]) => void,
): ToolbarConditionFilters {
  return {
    fields: questions.map((question) => ({
      key: question.key,
      label: question.label,
      type: question.kind,
      options: question.options,
    })),
    value: filters.map((filter) => {
      const field = questions.find(
        (question) => question.key === filter.questionKey,
      );
      return {
        fieldKey: filter.questionKey,
        operator:
          filter.operator ?? (field?.kind === "text" ? "contains" : "any"),
        values: field?.kind === "text" ? [filter.text] : filter.values,
      };
    }),
    onChange: (conditions) =>
      onChange(
        conditions.map((condition) => {
          const field = questions.find(
            (question) => question.key === condition.fieldKey,
          );
          return {
            questionKey: condition.fieldKey,
            operator: condition.operator,
            text: field?.kind === "text" ? (condition.values[0] ?? "") : "",
            values: field?.kind === "text" ? [] : condition.values,
          };
        }),
      ),
  };
}
