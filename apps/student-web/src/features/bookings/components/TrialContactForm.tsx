'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';
import { Checkbox } from '@altitutor/ui';
import { PhoneInput } from '@altitutor/ui';
import { Loader2 } from 'lucide-react';

const trialContactSchema = z.object({
  student_first_name: z.string().min(1, 'First name is required').max(100),
  student_last_name: z.string().min(1, 'Last name is required').max(100),
  student_email: z.string().email('Invalid email address'),
  student_phone: z.string().min(1, 'Phone number is required'),
  curriculum: z.enum(['SACE', 'IB', 'PRESACE', 'PRIMARY'], {
    required_error: 'Please select a curriculum',
  }),
  year_level: z.enum(['Reception', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13']).optional(),
  skip_parent_details: z.boolean().default(false),
  parent_first_name: z.string().max(100).optional(),
  parent_last_name: z.string().max(100).optional(),
  parent_email: z.string().email('Invalid email address').optional().or(z.literal('')),
  parent_phone: z.string().optional(),
}).refine((data) => {
  // If not skipping parent details, require parent fields
  if (!data.skip_parent_details) {
    return true; // All parent fields are optional even when not skipping
  }
  return true;
});

export type TrialContactFormValues = z.infer<typeof trialContactSchema>;

interface TrialContactFormProps {
  onSubmit: (data: TrialContactFormValues) => void;
  defaultValues?: Partial<TrialContactFormValues>;
  isLoading?: boolean;
}

export function TrialContactForm({ onSubmit, defaultValues, isLoading = false }: TrialContactFormProps) {
  const form = useForm({
    resolver: zodResolver(trialContactSchema),
    defaultValues: {
      student_first_name: '',
      student_last_name: '',
      student_email: '',
      student_phone: '',
      curriculum: undefined as 'SACE' | 'IB' | 'PRESACE' | 'PRIMARY' | undefined,
      year_level: undefined,
      skip_parent_details: false,
      parent_first_name: '',
      parent_last_name: '',
      parent_email: '',
      parent_phone: '',
      ...defaultValues,
    },
  });

  const skipParentDetails = form.watch('skip_parent_details');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Student Details */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Student Details</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="student_first_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="student_last_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="student_email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email *</FormLabel>
                <FormControl>
                  <Input type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="student_phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone *</FormLabel>
                <FormControl>
                  <PhoneInput
                    value={field.value}
                    onChange={field.onChange}
                    error={form.formState.errors.student_phone?.message}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="curriculum"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Curriculum *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select curriculum" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="SACE">SACE</SelectItem>
                      <SelectItem value="IB">IB</SelectItem>
                      <SelectItem value="PRESACE">PRESACE</SelectItem>
                      <SelectItem value="PRIMARY">PRIMARY</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="year_level"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Year Level</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select year level" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Reception">Reception</SelectItem>
                      <SelectItem value="1">Year 1</SelectItem>
                      <SelectItem value="2">Year 2</SelectItem>
                      <SelectItem value="3">Year 3</SelectItem>
                      <SelectItem value="4">Year 4</SelectItem>
                      <SelectItem value="5">Year 5</SelectItem>
                      <SelectItem value="6">Year 6</SelectItem>
                      <SelectItem value="7">Year 7</SelectItem>
                      <SelectItem value="8">Year 8</SelectItem>
                      <SelectItem value="9">Year 9</SelectItem>
                      <SelectItem value="10">Year 10</SelectItem>
                      <SelectItem value="11">Year 11</SelectItem>
                      <SelectItem value="12">Year 12</SelectItem>
                      <SelectItem value="13">Year 13</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Parent Details */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <FormField
              control={form.control}
              name="skip_parent_details"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="cursor-pointer">
                      Skip parent details
                    </FormLabel>
                  </div>
                </FormItem>
              )}
            />
          </div>

          {!skipParentDetails && (
            <>
              <h3 className="text-lg font-semibold">Parent Details (Optional)</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="parent_first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="parent_last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="parent_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="parent_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <PhoneInput
                        value={field.value || ''}
                        onChange={field.onChange}
                        error={form.formState.errors.parent_phone?.message}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            'Continue to Time Selection'
          )}
        </Button>
      </form>
    </Form>
  );
}

