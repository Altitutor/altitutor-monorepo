export function formatOrdinal(value: number): string {
  const rounded = Math.round(value);
  const modulo100 = rounded % 100;
  const suffix =
    modulo100 >= 11 && modulo100 <= 13
      ? "th"
      : rounded % 10 === 1
        ? "st"
        : rounded % 10 === 2
          ? "nd"
          : rounded % 10 === 3
            ? "rd"
            : "th";
  return `${rounded}${suffix}`;
}

export function formatPercentile(value: number): string {
  return `${formatOrdinal(value)} percentile`;
}
