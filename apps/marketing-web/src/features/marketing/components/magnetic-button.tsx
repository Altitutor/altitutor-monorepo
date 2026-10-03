import type { ReactNode } from "react";
import styles from "./magnetic-button.module.css";

/** Shared filled hover treatment. The enclosing link/button owns semantics. */
export function MagneticButton({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`${styles.magnetic} inline-flex items-center justify-center gap-2 rounded-full ${className}`}
    >
      {children}
    </span>
  );
}
