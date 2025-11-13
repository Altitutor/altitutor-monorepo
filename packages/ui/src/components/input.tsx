import * as React from "react"

import { cn } from "../lib/cn"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, value, onChange, ...props }, ref) => {
    // If onChange is provided, the input MUST be controlled from the start
    // Always ensure value is a string (never undefined) when controlled to prevent warnings
    const hasOnChange = onChange !== undefined;
    
    // When onChange is provided, ALWAYS set value prop to a string (never undefined)
    // This ensures React sees it as controlled from the very first render
    // Only allow uncontrolled if neither value nor onChange is provided
    const inputProps: React.InputHTMLAttributes<HTMLInputElement> = {
      ...props,
    };
    
    if (hasOnChange) {
      // When onChange exists, always set value to ensure controlled behavior
      inputProps.value = String(value ?? '');
      inputProps.onChange = onChange;
    } else if (value !== undefined) {
      // If value is provided without onChange, still ensure it's a string
      inputProps.value = String(value ?? '');
    }
    // If neither value nor onChange is provided, leave inputProps.value undefined (uncontrolled)
    
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...inputProps}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
