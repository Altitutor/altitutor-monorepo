import { cn } from '../lib/cn';

interface AnimatedHamburgerIconProps {
  /** When true, shows X icon. When false, shows hamburger icon. */
  isOpen: boolean;
  className?: string;
}

/**
 * Animated hamburger icon that transforms into an X icon.
 * When isOpen is true, displays X. When false, displays hamburger.
 */
export function AnimatedHamburgerIcon({ isOpen, className }: AnimatedHamburgerIconProps) {
  return (
    <div className={cn("relative w-5 h-5 flex flex-col justify-center items-center", className)}>
      <span
        className={cn(
          "absolute w-5 h-0.5 bg-current transition-all duration-300 ease-in-out",
          isOpen ? "rotate-45 translate-y-0" : "-translate-y-1.5"
        )}
      />
      <span
        className={cn(
          "absolute w-5 h-0.5 bg-current transition-all duration-300 ease-in-out",
          isOpen ? "opacity-0" : "opacity-100"
        )}
      />
      <span
        className={cn(
          "absolute w-5 h-0.5 bg-current transition-all duration-300 ease-in-out",
          isOpen ? "-rotate-45 translate-y-0" : "translate-y-1.5"
        )}
      />
    </div>
  );
}
