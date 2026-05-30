import * as React from "react"

import { cn } from "../lib/cn"
import { isNativeDateTimeInputType, NATIVE_DATETIME_INPUT_CLASSNAME } from "../lib/native-datetime-input"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, value, onChange, ...props }, ref) => {
    // Check if value is explicitly provided (not undefined)
    // This allows react-hook-form's register to work in uncontrolled mode
    // (register provides onChange but manages value internally via ref)
    const hasExplicitValue = value !== undefined;
    const hasOnChange = onChange !== undefined;
    
    const inputProps: React.InputHTMLAttributes<HTMLInputElement> = {
      ...props,
    };
    
    // Only force controlled mode if value is explicitly provided
    // This allows react-hook-form's register to work properly
    if (hasExplicitValue) {
      // When value is explicitly provided, always ensure it's a string
      inputProps.value = String(value ?? '');
      if (hasOnChange) {
        inputProps.onChange = onChange;
      }
    } else if (hasOnChange) {
      // If onChange exists but value is not provided, let react-hook-form manage it
      // Don't force value prop - allow uncontrolled mode for form libraries
      inputProps.onChange = onChange;
    }
    // If neither value nor onChange is provided, leave inputProps.value undefined (uncontrolled)
    
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          isNativeDateTimeInputType(type) && NATIVE_DATETIME_INPUT_CLASSNAME,
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
