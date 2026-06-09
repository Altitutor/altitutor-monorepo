const BUTTON_BASE =
  "inline-flex min-h-[32px] min-w-[32px] items-center justify-center rounded-[4px] border border-[#414042] px-2 text-center font-semibold shadow-[0_1px_0_rgba(0,0,0,0.4)]";

export function CalcKeyChip({
  label,
  onClick,
  onRemove,
  disabled,
}: {
  label: string;
  onClick?: () => void;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  const isNumberOrDot = /^[0-9.]$/.test(label);
  const variant = isNumberOrDot
    ? "bg-[#F5F5F5] text-black text-[11pt]"
    : "bg-[#DE1F2A] text-white text-[10pt]";

  return (
    <span className="group relative inline-block">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`${BUTTON_BASE} ${variant}`}
      >
        {label === "sqrt" ? "√" : label}
      </button>
      {onRemove ? (
        <button
          type="button"
          aria-label={`Remove ${label}`}
          onClick={onRemove}
          className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground group-hover:flex"
        >
          ×
        </button>
      ) : null}
    </span>
  );
}

export function CalcKeyDisplay({ label }: { label: string }) {
  const isNumberOrDot = /^[0-9.]$/.test(label);
  const variant = isNumberOrDot
    ? "bg-[#F5F5F5] text-black text-[11pt]"
    : "bg-[#DE1F2A] text-white text-[10pt]";

  return (
    <span className={`${BUTTON_BASE} ${variant} cursor-default`}>
      {label === "sqrt" ? "√" : label}
    </span>
  );
}
