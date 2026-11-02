"use client";
import { FormControl, FormField, FormItem, FormMessage } from "@altitutor/ui";
import type { UseFormReturn } from "react-hook-form";
import { PrioritySelect } from "@/shared/components/PrioritySelect";
import type { IssueFormData } from "../../types";

export function IssuePriorityField({
  form,
}: {
  form: UseFormReturn<IssueFormData>;
}) {
  return (
    <FormField
      control={form.control}
      name="priority"
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <PrioritySelect
              value={field.value ?? 0}
              onValueChange={field.onChange}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
