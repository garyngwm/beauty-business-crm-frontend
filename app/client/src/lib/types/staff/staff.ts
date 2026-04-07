import { z } from "zod";

// Staff
const staffBaseSchema = z.object({
  // Basic details
  firstName: z.string().trim().min(1, "Required").max(255),
  lastName: z.string().trim().min(1, "Required").max(255),
  email: z.string().trim().min(1, "Required").max(255),
  phone: z.string().trim().min(1, "Required").max(20),
  role: z.string().trim().min(1, "Required").max(255),
});

export const staffFormSchema = staffBaseSchema.extend({
  // Locations
  locations: z.array(z.number()).min(1, "Please select at least one location"),
});

export type StaffFormData = z.infer<typeof staffFormSchema>;
export type UpsertData = StaffFormData & {
  active: boolean;
  bookable: boolean;
};

const staffWithLocationsResponseSchema = staffFormSchema.extend({
  id: z.number().int().positive("ID must be a positive integer"),

  // Filter fields
  active: z.boolean(),
  bookable: z.boolean(),
});

const staffResponseSchema = staffBaseSchema.extend({
  id: z.number().int().positive("ID must be a positive integer"),

  // Filter fields
  active: z.boolean(),
  bookable: z.boolean(),
});

export type StaffWithLocationsResponse = z.infer<
  typeof staffWithLocationsResponseSchema
>;

export type StaffResponse = z.infer<typeof staffResponseSchema>;

export type StaffStatsResponse = {
  active: number;
  inactive: number;
};

// SPACER
// Filter options
export const filterFormSchema = z.object({
  location: z.number(),
  type: z.string().optional(),
});

export type FilterFormData = z.infer<typeof filterFormSchema>;
