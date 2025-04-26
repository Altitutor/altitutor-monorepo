import { cn } from "@/lib/utils";

interface SpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function Spinner({ className, size = "md" }: SpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-8 w-8 border-2",
    lg: "h-12 w-12 border-3",
  };

  return (
    <div 
      className={cn(
        "animate-spin rounded-full border-b-transparent border-primary", 
        sizeClasses[size],
        className
      )} 
    />
  );
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-4">
      <Spinner />
    </div>
  );
} 