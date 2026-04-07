import { z } from "zod";

export const serviceBaseSchema = z.object({
  // Basic details
  name: z.string().trim().min(1, "Required").max(255),
  categoryId: z
    .number({ required_error: "Required" })
    .int("Integer only")
    .nonnegative(),
  duration: z
    .number({ required_error: "Required" })
    .int("Integer only")
    .nonnegative(), // minutes
  description: z.string().trim().max(255).optional(),

  // Pricing
  priceType: z.enum(["Fixed", "Free"]),
  cashPrice: z.number().int().nonnegative(),
  creditCost: z.number().int().nonnegative(),
});

// ----------------------
// Form schema
// ----------------------
export const serviceFormSchema = serviceBaseSchema.extend({
  // Selected outlets (IDs)
  locations: z.array(z.number().int().positive()).min(1, "At least one location"),

  gstOutletIds: z
    .array(z.number().int().positive())
    .min(1, "Select at least one outlet")
    .default([1]),

  /**
   * GST % per outlet keyed by outletId (optional)
   */
  gstByOutlet: z
    .record(
      z.coerce
        .number()
        .min(0, "Must be 0 - 100")
        .max(100, "Must be 0 - 100")
    )
    .optional(),

  gstPercent: z.number().min(0).max(100).default(0),
});

// ----------------------
// Upsert payload schema (optional helper)
// ----------------------
export const serviceUpsertSchema = serviceBaseSchema.extend({
  active: z.boolean(),
  onlineBookings: z.boolean(),
  commissions: z.boolean(),

  gstPercent: z.number().min(0).max(100).default(0),

  gstOutletIds: z.array(z.number().int().positive()).min(1).default([1]),

  locations: z.array(z.number().int().positive()).min(1, "At least one location"),
});

// ----------------------
// Response schemas
// ----------------------
export const serviceResponseSchema = serviceBaseSchema.extend({
  id: z.number().positive(),

  active: z.boolean(),
  onlineBookings: z.boolean(),
  commissions: z.boolean(),

  locations: z.array(
    z.object({
      outletId: z.number().int().positive(),
      gstPercent: z.number().min(0).max(100),
    })
  ),
});

/**
 * If your backend returns locations as number[] only, change this back to:
 *   locations: z.array(z.number().int().positive())
 *
 * But recommended (and matches your GST-by-outlet requirement):
 *   locations: [{ outletId, gstPercent }]
 */
export const serviceWithLocationsResponseSchema = serviceBaseSchema.extend({
  id: z.number().positive(),

  active: z.boolean(),
  onlineBookings: z.boolean(),
  commissions: z.boolean(),

  gstPercent: z.number().min(0).max(100).default(0),

  gstOutletIds: z.array(z.number().int().positive()).default([]),
  locations: z.array(z.number().int().positive()),
});

// ----------------------
// Types
// ----------------------
export type ServiceFormData = z.infer<typeof serviceFormSchema>;

export type ServiceUpsertData = z.infer<typeof serviceUpsertSchema>;

export type ServiceResponse = z.infer<typeof serviceResponseSchema>;

export type ServiceWithLocationsResponse = z.infer<
  typeof serviceWithLocationsResponseSchema
>;

// ----------------------
// Filter options (unchanged)
// ----------------------
export const filterFormSchema = z.object({
  status: z.string().optional(),
  onlineBookings: z.string().optional(),
  commissions: z.string().optional(),
});

export type FilterFormData = z.infer<typeof filterFormSchema>;
