export const FORM_ACCESS_TYPES = ['public_link', 'authenticated'] as const;
export type FormAccessType = (typeof FORM_ACCESS_TYPES)[number];

export const FORM_WORKFLOW_KEYS = ['student_unenrolment', 'student_discontinuation'] as const;
export type FormWorkflowKey = (typeof FORM_WORKFLOW_KEYS)[number];
export const FORM_WORKFLOW_KEY_OPTIONS = [
  { value: 'student_unenrolment', label: 'Student unenrolment' },
  { value: 'student_discontinuation', label: 'Student discontinuation' },
] as const;

export const FORM_SUBMISSION_LIMITS = [
  'one_per_token',
  'one_per_authenticated_respondent',
  'unlimited',
] as const;
export type FormSubmissionLimit = (typeof FORM_SUBMISSION_LIMITS)[number];

export const FORM_PURPOSE_OPTIONS = [
  { value: 'feedback', label: 'Feedback' },
  { value: 'check_in', label: 'Check-in' },
  { value: 'unenrolment', label: 'Unenrolment' },
  { value: 'discontinuation', label: 'Discontinuation' },
  { value: 'unsubscribe', label: 'Unsubscribe' },
  { value: 'other', label: 'Other' },
] as const;

export type FormQuestionType =
  | 'single_choice'
  | 'multi_select'
  | 'short_text'
  | 'long_text'
  | 'number';

export type FormBlockType = FormQuestionType | 'content';

export type FormButtonStyle = 'primary' | 'secondary';
export type FormRichTextJson = Record<string, unknown>;

export interface FormContentButton {
  id: string;
  label: string;
  href: string;
  style: FormButtonStyle;
  openInNewTab?: boolean;
}

export interface FormContentBlock {
  id: string;
  type: 'content';
  title?: string;
  body: FormRichTextJson;
  buttons?: FormContentButton[];
}

export interface FormBaseQuestion {
  id: string;
  type: FormQuestionType;
  title: string;
  description?: string;
  required: boolean;
}

export interface FormChoiceOption {
  id: string;
  label: string;
  value: string;
  allowOtherText?: boolean;
}

export interface FormChoiceQuestion extends FormBaseQuestion {
  type: 'single_choice' | 'multi_select';
  options: FormChoiceOption[];
}

export interface FormTextQuestion extends FormBaseQuestion {
  type: 'short_text' | 'long_text';
}

export interface FormNumberQuestion extends FormBaseQuestion {
  type: 'number';
  min?: number;
  max?: number;
  step?: number;
  display: 'input' | 'slider' | 'rating';
}

export type FormQuestion = FormChoiceQuestion | FormTextQuestion | FormNumberQuestion;
export type FormBlock = FormContentBlock | FormQuestion;

export interface FormDefinition {
  blocks: FormBlock[];
  thankYouMessage: string;
}

export type FormAnswerValue = string | string[] | number | null;
export type FormAnswerPayload = Record<string, FormAnswerValue>;

export interface NormalizedFormAnswer {
  questionId: string;
  questionLabelSnapshot: string;
  questionType: FormQuestionType;
  choiceValue?: string | null;
  choiceLabelSnapshot?: string | null;
  choiceValues?: Array<{ value: string; label: string }> | null;
  textValue?: string | null;
  numberValue?: number | null;
}
