"use client";
import { FormControl, FormField, FormItem, FormMessage } from "@altitutor/ui";
import type { UseFormReturn } from "react-hook-form";
import { PrioritySelect } from "@/shared/components/PrioritySelect";
import type { TaskFormData } from "../../types";

export function TaskPriorityField({
  form,
}: {
  form: UseFormReturn<TaskFormData>;
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
