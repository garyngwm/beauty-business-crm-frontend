import { z } from "zod";

// Enums
const ReminderEnum = z.enum(["Email + SMS", "SMS only", "Email only"]);
const MembershipStatusEnum = z.enum(["Active", "Inactive"]);

export const customerFormSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  email: z.string().email("Required"),
  phone: z.string().min(1, "Required").max(20),
  birthday: z.string().optional(), // YYYY-MM-DD
  creditBalance: z.coerce.number().int("Credits must be a whole number").min(0)
});

export type CustomerFormData = z.infer<typeof customerFormSchema>;

const customerResponseSchema = customerFormSchema.extend({
  id: z.number().int().positive(),
  creditBalance: z.number().int(),
  createdAt: z.string().datetime(),

  membershipType: z.string().max(50).optional().nullable(),
  membershipStatus: MembershipStatusEnum,

  // Preferences
  preferredTherapistId: z.number().int().positive().optional().nullable(),
  preferredOutletId: z.number().int().positive().optional().nullable(),
  allergies: z.array(z.string()),
  reminders: ReminderEnum,
});

export type CustomerResponse = z.infer<typeof customerResponseSchema>;
