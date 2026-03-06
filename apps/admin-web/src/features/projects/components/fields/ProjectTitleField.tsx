'use client';

import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  Input,
} from '@altitutor/ui';
import { UseFormReturn } from 'react-hook-form';
import type { ProjectFormData } from '../../types';

interface ProjectTitleFieldProps {
  form: UseFormReturn<ProjectFormData>;
  onEnter?: () => void;
  titleRef?: React.RefObject<HTMLInputElement | null>;
}

export function ProjectTitleField({ form, onEnter, titleRef }: ProjectTitleFieldProps) {
  return (
    <FormField
      control={form.control}
      name="name"
      render={({ field }) => {
        const { ref, ...rest } = field;
        return (
          <FormItem>
            <FormControl>
              <Input
                ref={(node) => {
                  ref(node);
                  if (titleRef) (titleRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
                }}
                {...rest}
              placeholder="Project title"
              className="text-2xl font-semibold border-none shadow-none focus-visible:ring-0 px-0 h-auto min-h-[40px] whitespace-nowrap overflow-hidden text-ellipsis"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && onEnter) {
                  e.preventDefault();
                  onEnter();
                }
              }}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
        );
      }}
    />
  );
}
