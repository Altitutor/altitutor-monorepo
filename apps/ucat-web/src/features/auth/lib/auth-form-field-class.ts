/** Shared native `<input>` look for auth flows (signup OTP, etc.). */
export const authFormFieldClass =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground caret-foreground outline-none transition-all " +
  "placeholder:text-muted-foreground focus:border-primary/40 focus:ring-2 focus:ring-ring/30 disabled:opacity-50 " +
  "[&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_hsl(var(--background))] [&:-webkit-autofill]:[-webkit-text-fill-color:hsl(var(--foreground))] " +
  "[&:-webkit-autofill]:[transition:background-color_9999s_ease-out_0s]";
