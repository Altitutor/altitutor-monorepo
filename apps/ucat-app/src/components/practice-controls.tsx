import { Action, Copy } from "./ui";
import type { ChoiceProps, PaceProps } from "./practice-controls.types";
export function Choice({ label, value, onChange, options }: ChoiceProps) {
  return (
    <>
      <Copy>{label}</Copy>
      {options.map((o) => (
        <Action
          key={o.value}
          secondary={value !== o.value}
          title={o.label}
          onPress={() => onChange(o.value)}
        />
      ))}
    </>
  );
}
export function PaceSlider({ value, onChange }: PaceProps) {
  return (
    <Choice
      label="Pace"
      value={value}
      onChange={onChange}
      options={[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((value) => ({
        value,
        label: `${value}×`,
      }))}
    />
  );
}
