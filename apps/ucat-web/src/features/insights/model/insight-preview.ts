export type InsightPreviewCase<Input, RuleId extends string = string> = {
  label: string;
  condition: string;
  input: Input;
  expectedRuleId: RuleId;
};

export type ResolvedInsightPreview = {
  family: string;
  label: string;
  condition: string;
  ruleId: string;
  title: string;
  body: string;
  input: unknown;
  contextHref: string;
  actionLabel?: string;
  actionHref?: string;
  tone?: string;
};
