import { z } from "zod"

// Common validation patterns
const patterns = {
  phone: /^\+?[1-9]\d{1,14}$/,
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
}

// Common validation messages
const messages = {
  required: "This field is required",
  email: "Please enter a valid email address",
  phone: "Please enter a valid phone number",
  minLength: (field: string, length: number) =>
    `${field} must be at least ${length} characters`,
  maxLength: (field: string, length: number) =>
    `${field} must not exceed ${length} characters`,
  numeric: "Please enter a valid number",
  date: "Please enter a valid date",
  future: "Date must be in the future",
  past: "Date must be in the past",
}

// Base schemas for common fields
export const baseSchemas = {
  name: z
    .string()
    .min(2, { message: messages.minLength("Name", 2) })
    .max(100, { message: messages.maxLength("Name", 100) }),
  email: z.string().email({ message: messages.email }),
  phone: z.string().regex(patterns.phone, { message: messages.phone }),
  date: z.date({ required_error: messages.required, invalid_type_error: messages.date }),
  futureDate: z.date().min(new Date(), { message: messages.future }),
  pastDate: z.date().max(new Date(), { message: messages.past }),
  numeric: z.number({ required_error: messages.required, invalid_type_error: messages.numeric }),
}

// Student form schema
export const studentSchema = z.object({
  firstName: baseSchemas.name,
  lastName: baseSchemas.name,
  email: baseSchemas.email,
  phone: baseSchemas.phone.optional(),
  dateOfBirth: baseSchemas.pastDate,
  schoolName: z.string().min(1, { message: messages.required }),
  yearLevel: z.number().min(1).max(12),
  subjects: z.array(z.string()).min(1, { message: "Please select at least one subject" }),
  parentName: baseSchemas.name,
  parentEmail: baseSchemas.email,
  parentPhone: baseSchemas.phone,
})

// Tutor form schema
export const tutorSchema = z.object({
  firstName: baseSchemas.name,
  lastName: baseSchemas.name,
  email: baseSchemas.email,
  phone: baseSchemas.phone,
  dateOfBirth: baseSchemas.pastDate,
  subjects: z.array(z.string()).min(1, { message: "Please select at least one subject" }),
  availability: z.array(
    z.object({
      day: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]),
      startTime: z.string(),
      endTime: z.string(),
    })
  ),
  qualifications: z.array(
    z.object({
      degree: z.string(),
      institution: z.string(),
      yearCompleted: z.number().optional(),
    })
  ),
})

// Class form schema
export const classSchema = z.object({
  subject: z.string().min(1, { message: messages.required }),
  startDate: baseSchemas.futureDate,
  endDate: baseSchemas.futureDate,
  startTime: z.string(),
  endTime: z.string(),
  students: z.array(z.string()).min(1, { message: "Please select at least one student" }),
  tutor: z.string().min(1, { message: "Please select a tutor" }),
  location: z.string().min(1, { message: messages.required }),
})

// Payment form schema
export const paymentSchema = z.object({
  student: z.string().min(1, { message: "Please select a student" }),
  amount: z.number().positive({ message: "Amount must be greater than 0" }),
  paymentDate: baseSchemas.date,
  paymentMethod: z.enum(["cash", "card", "bank_transfer"]),
  invoiceNumber: z.string().optional(),
})

// Helper function to create a form schema with custom fields
export function createFormSchema<T extends z.ZodRawShape>(schema: T) {
  return z.object(schema)
}

// Helper function to validate a single field
export async function validateField<T extends z.ZodType>(
  schema: T,
  value: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    await schema.parseAsync(value)
    return { success: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message }
    }
    return { success: false, error: "Validation failed" }
  }
} 