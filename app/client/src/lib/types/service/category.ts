import { z } from "zod";

// Service category
export const categoryFormSchema = z.object({
  title: z.string().min(1, "Required"),
  color: z.string().min(1, "Required"),
  description: z.string().max(255).optional(),
});

const categoryResponseSchema = categoryFormSchema.extend({
  id: z.number().positive(),
});

const categoryWithCountResponseSchema = categoryResponseSchema.extend({
  serviceCount: z.number().nonnegative(),
});

export type CategoryFormData = z.infer<typeof categoryFormSchema>;
export type CategoryResponse = z.infer<typeof categoryResponseSchema>;
export type CategoryWithCountResponse = z.infer<
  typeof categoryWithCountResponseSchema
>;
