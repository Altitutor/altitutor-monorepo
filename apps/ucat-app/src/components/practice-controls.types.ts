export type ChoiceProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  options: { value: number; label: string }[];
};
export type PaceProps = { value: number; onChange: (value: number) => void };
